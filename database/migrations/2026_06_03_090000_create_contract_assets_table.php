<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabela de bens oferecidos em garantia para contratos (1:N).
     *
     * Estratégia de modelagem: tabela única com colunas específicas anuláveis,
     * discriminadas pelo campo `assetType` ('vehicle' | 'real_estate').
     * Campos de veículos ficam vazios em imóveis e vice-versa — escolha feita
     * para evitar STI/JSON e manter o filtro/busca por coluna direta.
     */
    public function up(): void
    {
        Schema::create('contract_assets', function (Blueprint $table) {
            $table->id();

            $table->foreignId('contractId')
                  ->constrained('contracts')
                  ->cascadeOnDelete();

            $table->enum('assetType', ['vehicle', 'real_estate']);

            // ── Veículos (nullable) ────────────────────────────────────────
            $table->string('brand',           80)->nullable();
            $table->string('model',          120)->nullable();
            $table->unsignedSmallInteger('manufactureYear')->nullable();
            $table->unsignedSmallInteger('modelYear')->nullable();
            $table->string('plate',           10)->nullable();
            $table->string('renavam',         20)->nullable();
            // Chassi VIN é sempre 17 caracteres alfanuméricos.
            $table->string('chassis',         17)->nullable();

            // ── Imóveis (nullable) ─────────────────────────────────────────
            $table->text  ('description')->nullable();
            $table->string('location',       255)->nullable();
            $table->string('registryNumber',  60)->nullable();
            // decimal(12,2) permite somar/ordenar áreas; o front formata "521,81 m²".
            $table->decimal('totalArea',      12, 2)->nullable();
            $table->text  ('boundaries')->nullable();

            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();

            $table->index('contractId');
            $table->index('assetType');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_assets');
    }
};
