<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Alinhamento da tabela `users` para suportar autenticação nativa do Laravel.
 *
 * Mantém as colunas legadas (openId, loginMethod, role) e adiciona os campos
 * necessários para o fluxo de login por senha + "Lembrar-me" + recuperação.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'password')) {
                $table->string('password')->nullable()->after('email');
            }
            if (! Schema::hasColumn('users', 'remember_token')) {
                $table->rememberToken()->after('password');
            }
            if (! Schema::hasColumn('users', 'email_verified_at')) {
                $table->timestamp('email_verified_at')->nullable()->after('email');
            }
        });

        // openId é UNIQUE NOT NULL na migration original. Garantimos um valor
        // padrão para registros novos criados via CRUD administrativo, mas o
        // ajuste real é feito no controller (geramos um UUID por usuário).
        if (! Schema::hasTable('password_reset_tokens')) {
            Schema::create('password_reset_tokens', function (Blueprint $table) {
                $table->string('email')->primary();
                $table->string('token');
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('sessions')) {
            Schema::create('sessions', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->foreignId('user_id')->nullable()->index();
                $table->string('ip_address', 45)->nullable();
                $table->text('user_agent')->nullable();
                $table->longText('payload');
                $table->integer('last_activity')->index();
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'password')) {
                $table->dropColumn('password');
            }
            if (Schema::hasColumn('users', 'remember_token')) {
                $table->dropRememberToken();
            }
            if (Schema::hasColumn('users', 'email_verified_at')) {
                $table->dropColumn('email_verified_at');
            }
        });

        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
