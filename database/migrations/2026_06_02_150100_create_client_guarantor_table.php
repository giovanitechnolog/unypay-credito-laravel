<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_guarantor', function (Blueprint $table) {
            $table->id();

            $table->foreignId('clientId')
                  ->constrained('clients')
                  ->cascadeOnDelete();

            $table->foreignId('guarantorId')
                  ->constrained('guarantors')
                  ->cascadeOnDelete();

            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();

            // Impede duplicar o mesmo par (cliente, fiador)
            $table->unique(['clientId', 'guarantorId']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_guarantor');
    }
};
