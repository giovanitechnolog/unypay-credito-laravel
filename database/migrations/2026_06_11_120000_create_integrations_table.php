<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 🚀 Cadastro de Integrações Externas
 *
 * Tabela mestre de configurações de APIs que o sistema consome — Rodopar SIGx
 * (consulta de CPF), ReceitaWS (CNPJ), ViaCEP, Serasa, e qualquer endpoint
 * customizado adicionado pelo administrador.
 *
 * Campos sensíveis (apiKey/apiSecret/password) são criptografados na camada
 * do Eloquent (cast `encrypted`) — o conteúdo persistido no MySQL é o ciphertext.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('integrations')) {
            return;
        }

        Schema::create('integrations', function (Blueprint $table) {
            $table->id();

            $table->string('name', 255);
            $table->string('type', 50)->index();
            $table->string('environment', 20)->default('producao')->index();

            $table->string('baseUrl', 500);
            $table->string('testEndpoint', 500)->nullable();
            $table->string('authType', 20)->default('apikey');

            // Credenciais — todas anuláveis e armazenadas em ciphertext
            // pelo cast `encrypted` no Model. Por isso o tipo é TEXT
            // (o ciphertext é maior que o cleartext original).
            $table->text('apiKey')->nullable();
            $table->text('apiSecret')->nullable();
            $table->string('username', 255)->nullable();
            $table->text('password')->nullable();

            // Headers extras (formato livre) e descrição interna
            $table->json('extraHeaders')->nullable();
            $table->text('description')->nullable();

            $table->boolean('isActive')->default(true)->index();

            // Resultado do último "Testar" — alimentado pelo endpoint /test
            $table->timestamp('lastTestedAt')->nullable();
            $table->string('lastTestStatus', 20)->nullable();
            $table->text('lastTestMessage')->nullable();
            $table->integer('lastTestHttpCode')->nullable();

            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();

            // Garante uma única integração ativa por (tipo, ambiente). Permite
            // ter Rodopar Produção + Rodopar Sandbox ao mesmo tempo, mas evita
            // duplicidade do mesmo (tipo+ambiente).
            $table->unique(['type', 'environment'], 'integrations_type_env_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('integrations');
    }
};
