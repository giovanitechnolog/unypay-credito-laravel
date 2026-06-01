<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $blueprint) {
            // Campos cadastrais adicionais (não obrigatórios)
            $blueprint->string('cpf', 14)->nullable()->unique()->after('email');
            $blueprint->string('rg', 20)->nullable()->after('cpf');
            $blueprint->string('phone', 15)->nullable()->after('rg');
            $blueprint->date('birthDate')->nullable()->after('phone');
            $blueprint->string('gender', 20)->nullable()->after('birthDate');
            $blueprint->enum('status', ['Ativo', 'Inativo'])->default('Ativo')->after('role');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $blueprint) {
            $blueprint->dropColumn(['cpf', 'rg', 'phone', 'birthDate', 'gender', 'status']);
        });
    }
};