<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guarantors', function (Blueprint $table) {
            $table->id();

            $table->string('name', 255);
            $table->string('nationality', 80)->default('Brasileiro');
            $table->string('maritalStatus', 40)->nullable();

            // CPF nullable + unique permite "só RG"; MySQL aceita múltiplos NULLs em UNIQUE.
            $table->string('cpf', 14)->nullable()->unique();
            $table->string('rg',  20)->nullable();

            // Endereço destrinchado conforme briefing
            $table->string('street',       255)->nullable();
            $table->string('number',        20)->nullable();
            $table->string('neighborhood', 120)->nullable();
            $table->string('city',         120)->nullable();
            $table->char  ('state',          2)->nullable();
            $table->string('zipCode',       10)->nullable();

            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();

            $table->index('name');
            $table->index('cpf');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guarantors');
    }
};
