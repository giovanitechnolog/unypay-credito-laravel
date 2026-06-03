<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contract_guarantor', function (Blueprint $table) {
            $table->id();

            $table->foreignId('contractId')
                  ->constrained('contracts')
                  ->cascadeOnDelete();

            $table->foreignId('guarantorId')
                  ->constrained('guarantors')
                  ->cascadeOnDelete();

            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['contractId', 'guarantorId']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_guarantor');
    }
};
