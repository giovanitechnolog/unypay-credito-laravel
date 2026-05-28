<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ContractController extends Controller
{
    private const PDF_DIR  = 'contracts/pdfs';
    private const PDF_DISK = 'local';

    public function index(Request $request)
    {
        $search = $request->input('search');
        $statusFilter = $request->input('statusFilter');

        $query = DB::table('contracts')
            ->leftJoin('contract_types', 'contracts.contract_type_id', '=', 'contract_types.id')
            ->leftJoin('clients', 'contracts.clientId', '=', 'clients.id')
            ->select(
                'contracts.*',
                'contract_types.name as contract_type_name',
                'clients.name as client_name'
            );

        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('contracts.code', 'like', "%{$search}%")
                  ->orWhere('contracts.contractName', 'like', "%{$search}%")
                  ->orWhere('contracts.creditor', 'like', "%{$search}%")
                  ->orWhere('clients.name', 'like', "%{$search}%");
            });
        }

        if (!empty($statusFilter) && $statusFilter !== 'Todos') {
            $query->where('contracts.status', $statusFilter);
        }

        $rawContracts = $query->orderBy('contracts.id', 'desc')->get();

        // 🚀 VERIFICAÇÃO MULTI-PDF: Lê o array JSON do banco de dados para saber se há anexos
        $rawContracts->transform(function ($row) {
            $paths = json_decode($row->contractPdfPath ?? '[]', true);
            $row->hasContractPdf = !empty($paths) && count($paths) > 0;
            return $row;
        });

        $contractTypes = DB::table('contract_types')->orderBy('name', 'asc')->get();
        $clients = DB::table('clients')->orderBy('name', 'asc')->get(['id', 'name']);

        return Inertia::render('Contracts', [
            'contracts'     => $rawContracts,
            'contractTypes' => $contractTypes,
            'clients'       => $clients,
            'filters'       => $request->only(['search', 'statusFilter'])
        ]);
    }

    public function clientsLookup()
    {
        $clients = DB::table('clients')->orderBy('name', 'asc')->get(['id', 'name', 'document']);
        return response()->json($clients);
    }

    public function store(Request $request)
    {
        $request->validate([
            'contractName'     => 'required|string',
            'code'             => 'required|string',
            'clientId'         => 'required',
            'contract_type_id' => 'required',
            'contractPdfs'     => 'nullable|array', // Valida como um array de arquivos
            'contractPdfs.*'   => 'file|mimes:pdf|max:20480',
        ]);

        $pdfPaths = [];
        $pdfNames = [];

        if ($request->hasFile('contractPdfs')) {
            foreach ($request->file('contractPdfs') as $file) {
                $pdfPaths[] = $file->store(self::PDF_DIR, self::PDF_DISK);
                $pdfNames[] = $file->getClientOriginalName();
            }
        }

        $extras = [
            'sourcePdfName'   => json_encode($pdfNames),
            'contractPdfPath' => json_encode($pdfPaths),
            'user_id'         => \Illuminate\Support\Facades\Auth::id(),
        ];

        DB::table('contracts')->insert($this->buildContractPayload($request, $extras));

        return redirect()->route('contracts.index');
    }

    public function update(Request $request, int $id)
    {
        $request->validate([
            'contractName'     => 'required|string',
            'code'             => 'required|string',
            'clientId'         => 'required',
            'contract_type_id' => 'required',
            'contractPdfs'     => 'nullable|array',
        ]);

        $existing = DB::table('contracts')->where('id', $id)->first();
        if (!$existing) {
            return redirect()->route('contracts.index');
        }

        $extras = [
            'user_id' => \Illuminate\Support\Facades\Auth::id()
        ];

        // Se o operador enviou um novo lote de arquivos, substitui os antigos
        if ($request->hasFile('contractPdfs')) {
            $pdfPaths = [];
            $pdfNames = [];

            foreach ($request->file('contractPdfs') as $file) {
                $pdfPaths[] = $file->store(self::PDF_DIR, self::PDF_DISK);
                $pdfNames[] = $file->getClientOriginalName();
            }

            // Exclui fisicamente do disco os arquivos antigos para não entulhar o Laragon
            $oldPaths = json_decode($existing->contractPdfPath ?? '[]', true);
            if (is_array($oldPaths)) {
                foreach ($oldPaths as $oldPath) {
                    if (!empty($oldPath) && Storage::disk(self::PDF_DISK)->exists($oldPath)) {
                        Storage::disk(self::PDF_DISK)->delete($oldPath);
                    }
                }
            }

            $extras['contractPdfPath'] = json_encode($pdfPaths);
            $extras['sourcePdfName']   = json_encode($pdfNames);
        }

        DB::table('contracts')
            ->where('id', $id)
            ->update($this->buildContractPayload($request, $extras, isUpdate: true));

        return redirect()->route('contracts.index');
    }

    public function cancel(int $id)
    {
        DB::table('contracts')->where('id', $id)->update([
            'status' => 'Cancelado',
            'user_id' => \Illuminate\Support\Facades\Auth::id()
        ]);
        return redirect()->back();
    }

    public function reactivate(int $id)
    {
        DB::table('contracts')->where('id', $id)->update([
            'status' => 'Ativo',
            'user_id' => \Illuminate\Support\Facades\Auth::id()
        ]);
        return redirect()->back();
    }

    /**
     * 🚀 LEITURA DINÂMICA DE ARQUIVO POR ÍNDICE
     */
    public function viewPdf(int $id, Request $request)
    {
        $contract = DB::table('contracts')->where('id', $id)->first();
        if (!$contract || empty($contract->contractPdfPath)) {
            abort(404, 'Nenhum PDF encontrado.');
        }

        $paths = json_decode($contract->contractPdfPath, true);
        $names = json_decode($contract->sourcePdfName, true);

        // Captura o índice enviado pelo React (ex: ?index=2). Se não enviar nada, mostra o primeiro (0)
        $index = (int)$request->input('index', 0);

        if (!isset($paths[$index])) {
            abort(404, 'O documento solicitado não existe.');
        }

        $targetPath = $paths[$index];
        $disk = Storage::disk(self::PDF_DISK);
        
        if (!$disk->exists($targetPath)) {
            abort(404, 'Arquivo físico ausente.');
        }

        $stream = $disk->readStream($targetPath);
        $filename = $names[$index] ?? ('documento-' . $index . '.pdf');

        return new StreamedResponse(function () use ($stream) {
            fpassthru($stream);
        }, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . addslashes($filename) . '"',
        ]);
    }

    public function destroy(int $id)
    {
        $contract = DB::table('contracts')->where('id', $id)->first();
        if ($contract && !empty($contract->contractPdfPath)) {
            $paths = json_decode($contract->contractPdfPath, true);
            if (is_array($paths)) {
                foreach ($paths as $path) {
                    if (!empty($path) && Storage::disk(self::PDF_DISK)->exists($path)) {
                        Storage::disk(self::PDF_DISK)->delete($path);
                    }
                }
            }
        }

        DB::table('contracts')->where('id', $id)->delete();
        return redirect()->back();
    }

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

        foreach ($extras as $key => $value) {
            if ($isUpdate && $value === null) {
                continue;
            }
            $payload[$key] = $value;
        }

        return $payload;
    }
}