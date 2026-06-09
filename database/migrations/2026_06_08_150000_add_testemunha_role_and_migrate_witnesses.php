<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 🚀 Unifica TESTEMUNHAS no mesmo cadastro mestre de Fiadores/Codevedores.
 *
 * Estratégia (mesma filosofia do `add_role_to_contract_guarantor`):
 *   • A coluna `role` da pivot `contract_guarantor` ganha o valor 'TESTEMUNHA'.
 *   • Tudo que estava em `contract_witnesses` (nome + CPF + CI) é migrado para
 *     a tabela mestre `guarantors` (com personType='PF') e a pivot
 *     `contract_guarantor` (role='TESTEMUNHA') — assim, testemunhas passam a
 *     compartilhar a mesma UX/relacionamento dos fiadores: busca, sugestões
 *     por cliente, criação on-the-fly, etc.
 *   • A tabela `contract_witnesses` é descartada ao final (deixa de ser
 *     fonte de verdade).
 *
 * Reentrante: se rodada várias vezes sem `migrate:rollback` (ex.: pipelines
 * com `migrate --pretend` + retry), só altera o enum quando necessário e só
 * faz o copy/dropar a tabela quando ela realmente existir.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1️⃣  Expande o enum `role` para incluir TESTEMUNHA.
        //     Usamos DDL bruto porque o doctrine/dbal não trata enums no MySQL
        //     de forma confiável, e o `ALTER ... MODIFY` é atômico aqui.
        DB::statement(
            "ALTER TABLE contract_guarantor "
            . "MODIFY role ENUM('FIADOR', 'CODEVEDOR', 'TESTEMUNHA') NOT NULL DEFAULT 'FIADOR'"
        );

        // 2️⃣  Migra dados da tabela legada `contract_witnesses` para o
        //     cadastro mestre (`guarantors`) e a pivot (`contract_guarantor`).
        //
        //     Algoritmo por testemunha:
        //       • Normaliza CPF (apenas dígitos);
        //       • Se já existe um guarantor com esse CPF, reusa o id;
        //       • Caso contrário, cria um novo guarantor PF mínimo (name+cpf+rg);
        //       • Insere a linha na pivot com role='TESTEMUNHA' (idempotente).
        if (Schema::hasTable('contract_witnesses')) {
            $hasCi = Schema::hasColumn('contract_witnesses', 'ci');

            $witnesses = DB::table('contract_witnesses')->get();
            foreach ($witnesses as $w) {
                $cpfDigits = preg_replace('/\D/', '', (string) $w->cpf);
                $ci        = $hasCi ? ($w->ci ?? null) : null;

                $guarantorId = null;
                if ($cpfDigits !== '') {
                    $existing = DB::table('guarantors')->where('cpf', $cpfDigits)->first();
                    if ($existing) {
                        $guarantorId = (int) $existing->id;
                    }
                }

                if (! $guarantorId) {
                    $guarantorId = DB::table('guarantors')->insertGetId([
                        'name'          => $w->name ?? 'Testemunha sem nome',
                        'personType'    => 'PF',
                        'nationality'   => 'Brasileiro',
                        'maritalStatus' => null,
                        'cpf'           => $cpfDigits !== '' ? $cpfDigits : null,
                        'rg'            => $ci,
                        'createdAt'     => $w->createdAt ?? now(),
                        'updatedAt'     => $w->updatedAt ?? now(),
                    ]);
                }

                $alreadyLinked = DB::table('contract_guarantor')
                    ->where('contractId',  $w->contractId)
                    ->where('guarantorId', $guarantorId)
                    ->where('role',        'TESTEMUNHA')
                    ->exists();

                if (! $alreadyLinked) {
                    DB::table('contract_guarantor')->insert([
                        'contractId'  => $w->contractId,
                        'guarantorId' => $guarantorId,
                        'role'        => 'TESTEMUNHA',
                        'createdAt'   => $w->createdAt ?? now(),
                        'updatedAt'   => $w->updatedAt ?? now(),
                    ]);
                }
            }

            // 3️⃣  Tabela legada deixa de ser fonte de verdade.
            Schema::dropIfExists('contract_witnesses');
        }
    }

    public function down(): void
    {
        // ⚠️  Restaura a tabela `contract_witnesses` vazia (não tentamos
        //     reconstruir os dados — a granularidade de "ci" pode ter sido
        //     perdida no merge com guarantors). Em seguida, devolve o enum
        //     ao estado original sem TESTEMUNHA.
        if (! Schema::hasTable('contract_witnesses')) {
            Schema::create('contract_witnesses', function ($table) {
                $table->id();
                $table->foreignId('contractId')->constrained('contracts')->cascadeOnDelete();
                $table->string('name', 255);
                $table->string('cpf', 14);
                $table->string('ci', 50)->nullable();
                $table->timestamp('createdAt')->useCurrent();
                $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
                $table->index('contractId');
            });
        }

        // Remove vínculos de TESTEMUNHA antes de estreitar o enum (caso
        // contrário o MySQL recusa: valor existente fora do novo domínio).
        DB::table('contract_guarantor')->where('role', 'TESTEMUNHA')->delete();

        DB::statement(
            "ALTER TABLE contract_guarantor "
            . "MODIFY role ENUM('FIADOR', 'CODEVEDOR') NOT NULL DEFAULT 'FIADOR'"
        );
    }
};
