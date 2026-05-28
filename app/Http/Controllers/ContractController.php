<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ContractController extends Controller
{
    /**
     * Diretório onde os PDFs anexados aos contratos são salvos.
     *
     * Usamos o disk "local" (storage/app/private) para garantir que o
     * download/visualização sempre passe pela rota autenticada
     * {@see self::viewPdf()}, em vez de ser exposta diretamente via /storage.
     */
    private const PDF_DIR  = 'contracts/pdfs';
    private const PDF_DISK = 'local';

    /**
     * Listagem Geral de Contratos (Chamada ao clicar no Menu Lateral)
     * Rota: http://127.0.0.1:8000/contracts
     */
    public function index(Request $request)
    {
        $search = $request->input('search');
        $statusFilter = $request->input('statusFilter');

        // 🚀 CORREÇÃO: Adicionado o LEFT JOIN com a tabela 'clients' para buscar o nome do cliente
        $query = DB::table('contracts')
            ->leftJoin('contract_types', 'contracts.contract_type_id', '=', 'contract_types.id')
            ->leftJoin('clients', 'contracts.clientId', '=', 'clients.id') // 👈 Conexão com a tabela de clientes
            ->select(
                'contracts.*',
                'contract_types.name as contract_type_name',
                'clients.name as client_name' // 👈 Trazendo o nome do cliente mapeado para o React
            );

        // Aplica os filtros apenas se eles forem enviados de verdade pelo input
        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('contracts.code', 'like', "%{$search}%")
                  ->orWhere('contracts.contractName', 'like', "%{$search}%")
                  ->orWhere('contracts.creditor', 'like', "%{$search}%")
                  ->orWhere('clients.name', 'like', "%{$search}%"); // 👈 Permite buscar também pelo nome do cliente
            });
        }

        if (!empty($statusFilter) && $statusFilter !== 'Todos') {
            $query->where('contracts.status', $statusFilter);
        }

        $rawContracts = $query->orderBy('contracts.id', 'desc')->get();

        // Sinaliza se há PDF (sem expor o caminho cru); o front baixa via rota autenticada.
        $rawContracts->transform(function ($row) {
            $row->hasContractPdf = ! empty($row->contractPdfPath);
            return $row;
        });

        // 🚀 2. Coleta os tipos cadastrados via Seeder para alimentar o Dropdown do front-end
        $contractTypes = DB::table('contract_types')->orderBy('name', 'asc')->get();

        $clients = DB::table('clients')->orderBy('name', 'asc')->get(['id', 'name']);

        return Inertia::render('Contracts', [
            'contracts'     => $rawContracts,
            'contractTypes' => $contractTypes,
            'clients'       => $clients,
        ]);
    }

    /**
     * API auxiliar de lookup de clientes
     */
    public function clientsLookup()
    {
        $clients = DB::table('clients')
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'document']);

        return response()->json($clients);
    }

    /**
     * Salva o formulário original.
     *
     * Aceita um campo opcional `contractPdf` (arquivo .pdf) que, quando enviado,
     * é persistido no disk "public" sob {@see self::PDF_DIR}.
     */
    public function store(Request $request)
    {
        $request->validate([
            'contractName'     => 'required|string',
            'code'             => 'required|string',
            'clientId'         => 'required',
            'contract_type_id' => 'required',
            'contractPdf'      => 'nullable|file|mimes:pdf|max:20480',
        ]);

        $pdfPath = null;
        $pdfName = null;
        if ($request->hasFile('contractPdf')) {
            $file = $request->file('contractPdf');
            $pdfPath = $file->store(self::PDF_DIR, self::PDF_DISK);
            $pdfName = $file->getClientOriginalName();
        }

        DB::table('contracts')->insert($this->buildContractPayload($request, [
            'sourcePdfName'   => $pdfName,
            'contractPdfPath' => $pdfPath,
        ]));

        return redirect()->route('contracts.index');
    }

    /**
     * Atualiza um contrato existente.
     *
     * Mesmas regras do `store`, com tratamento adicional: se um novo PDF for
     * enviado, o anterior (se houver) é removido do disco.
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'contractName'     => 'required|string',
            'code'             => 'required|string',
            'clientId'         => 'required',
            'contract_type_id' => 'required',
            'contractPdf'      => 'nullable|file|mimes:pdf|max:20480',
        ]);

        $existing = DB::table('contracts')->where('id', $id)->first();
        if (! $existing) {
            return redirect()->route('contracts.index');
        }

        $extras = [];
        if ($request->hasFile('contractPdf')) {
            $file = $request->file('contractPdf');
            $extras['contractPdfPath'] = $file->store(self::PDF_DIR, self::PDF_DISK);
            $extras['sourcePdfName']   = $file->getClientOriginalName();

            if (! empty($existing->contractPdfPath) && Storage::disk(self::PDF_DISK)->exists($existing->contractPdfPath)) {
                Storage::disk(self::PDF_DISK)->delete($existing->contractPdfPath);
            }
        }

        DB::table('contracts')
            ->where('id', $id)
            ->update($this->buildContractPayload($request, $extras, isUpdate: true));

        return redirect()->route('contracts.index');
    }

    /**
     * Cancela o contrato: apenas altera o status para 'Cancelado'.
     */
    public function cancel($id)
    {
        DB::table('contracts')
            ->where('id', $id)
            ->update(['status' => 'Cancelado']);

        return redirect()->back();
    }

    /**
     * Reabre (reativa) o contrato cancelado, restaurando o status para 'Ativo'.
     * Útil quando o usuário clica novamente no botão de cancelamento.
     */
    public function reactivate($id)
    {
        DB::table('contracts')
            ->where('id', $id)
            ->update(['status' => 'Ativo']);

        return redirect()->back();
    }

    /**
     * Faz o download / visualização inline do PDF do contrato.
     */
    public function viewPdf($id)
    {
        $contract = DB::table('contracts')->where('id', $id)->first();
        if (! $contract || empty($contract->contractPdfPath)) {
            abort(404, 'PDF não encontrado para este contrato.');
        }

        $disk = Storage::disk(self::PDF_DISK);
        if (! $disk->exists($contract->contractPdfPath)) {
            abort(404, 'Arquivo PDF ausente no armazenamento.');
        }

        $stream = $disk->readStream($contract->contractPdfPath);
        $filename = $contract->sourcePdfName ?: ('contrato-' . $contract->code . '.pdf');

        return new StreamedResponse(function () use ($stream) {
            fpassthru($stream);
        }, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . addslashes($filename) . '"',
        ]);
    }

    /**
     * Remove o contrato selecionado
     */
    public function destroy($id)
    {
        $contract = DB::table('contracts')->where('id', $id)->first();
        if ($contract && ! empty($contract->contractPdfPath) && Storage::disk(self::PDF_DISK)->exists($contract->contractPdfPath)) {
            Storage::disk(self::PDF_DISK)->delete($contract->contractPdfPath);
        }

        DB::table('contracts')->where('id', $id)->delete();
        return redirect()->back();
    }

    /**
     * Monta o array de colunas mapeadas para gravação, espelhando o `emptyForm`
     * do front. Centralizado para evitar divergência entre store/update.
     *
     * @param  array<string,mixed>  $extras  Colunas extras (ex.: PDF) com prioridade.
     */
    private function buildContractPayload(Request $request, array $extras = [], bool $isUpdate = false): array
    {
        $payload = [
            'clientId'                         => $request->input('clientId'),
            'code'                             => $request->input('code'),
            'contractName'                     => $request->input('contractName'),
            'creditor'                         => $request->input('creditor'),
            'contract_type_id'                 => $request->input('contract_type_id'),
            'contractDate'                     => $request->input('contractDate'),
            'status'                           => $request->input('status', 'Ativo'),
            'validated'                        => filter_var($request->input('validated', false), FILTER_VALIDATE_BOOLEAN),
            'principalAmount'                  => $request->input('principalAmount', 0),
            'financedTotal'                    => $request->input('financedTotal', 0),
            'tacAmount'                        => $request->input('tacAmount', 0),
            'iofAmount'                        => $request->input('iofAmount', 0),
            'installmentCount'                 => $request->input('installmentCount', 12),
            'installmentAmount'                => $request->input('installmentAmount', 0),
            'firstDueDate'                     => $request->input('firstDueDate'),
            'monthlyInterestRate'              => $request->input('monthlyInterestRate', 0),
            'moraRateMonthly'                  => $request->input('moraRateMonthly', 0.02),
            'penaltyRate'                      => $request->input('penaltyRate', 0.1),
            'penaltyBaseType'                  => $request->input('penaltyBaseType', 'installment'),
            'penaltyScope'                     => $request->input('penaltyScope', 'per_installment'),
            'correctionIndex'                  => $request->input('correctionIndex', 'IPCA'),
            'honoraryRate'                     => $request->input('honoraryRate', 0),
            'accelerates'                      => filter_var($request->input('accelerates', false), FILTER_VALIDATE_BOOLEAN),
            'accelerationRule'                 => $request->input('accelerationRule'),
            'accelerationConsecutiveThreshold' => $request->input('accelerationConsecutiveThreshold'),
            'accelerationAlternateThreshold'   => $request->input('accelerationAlternateThreshold'),
            'guarantees'                       => $request->input('guarantees'),
            'guarantors'                       => $request->input('guarantors'),
            'validationUrl'                    => $request->input('validationUrl'),
            'observations'                     => $request->input('observations'),
        ];

        // No update mantemos quaisquer colunas extras (ex.: pdf) somente se foram informadas.
        foreach ($extras as $key => $value) {
            if ($isUpdate && $value === null) {
                continue;
            }
            $payload[$key] = $value;
        }

        return $payload;
    }
}
