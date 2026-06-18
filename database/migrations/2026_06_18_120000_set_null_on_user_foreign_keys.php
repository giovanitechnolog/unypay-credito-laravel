<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Permite excluir usuários sem apagar contratos, clientes, pagamentos etc.
 * As referências de auditoria (user_id / created_by) passam a ser anuladas
 * automaticamente quando o operador é removido.
 */
return new class extends Migration
{
    private array $references = [
        ['contracts', 'user_id'],
        ['clients', 'user_id'],
        ['payments', 'user_id'],
        ['users', 'created_by'],
    ];

    public function up(): void
    {
        foreach ($this->references as [$table, $column]) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, $column)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($column) {
                $blueprint->dropForeign([$column]);
            });

            Schema::table($table, function (Blueprint $blueprint) use ($column) {
                $blueprint->foreign($column)
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach ($this->references as [$table, $column]) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, $column)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($column) {
                $blueprint->dropForeign([$column]);
            });

            Schema::table($table, function (Blueprint $blueprint) use ($column) {
                $blueprint->foreign($column)
                    ->references('id')
                    ->on('users')
                    ->restrictOnDelete();
            });
        }
    }
};
