<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consignors', function (Blueprint $table) {
            $table->id();

            // Dados gerais — `document` aceita CPF (11) ou CNPJ (14) já normalizados.
            // Mantemos `unique` para evitar credores duplicados; aceita múltiplos NULL no MySQL.
            $table->string('document', 20)->nullable()->unique();
            $table->string('name', 255);
            $table->string('phone', 30)->nullable();
            $table->string('email', 320)->nullable();

            // Endereço destrinchado conforme briefing
            $table->string('street',       255)->nullable();
            $table->string('number',        20)->nullable();
            $table->string('neighborhood', 120)->nullable();
            $table->string('zipCode',       10)->nullable();
            $table->string('complement',   120)->nullable();
            $table->string('city',         120)->nullable();
            $table->char  ('state',          2)->nullable();

            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();

            $table->index('name');
            $table->index('document');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consignors');
    }
};
