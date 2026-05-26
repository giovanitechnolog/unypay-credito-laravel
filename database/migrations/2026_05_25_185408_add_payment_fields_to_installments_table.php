<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function run(): void
    {
        Schema::table('installments', function (Blueprint $table) {
            // Injeta os campos necessários para receber as baixas e valores reais da planilha
            if (!Schema::hasColumn('installments', 'paidAmount')) {
                $table->decimal('paidAmount', 15, 2)->nullable()->after('originalAmount');
            }
            if (!Schema::hasColumn('installments', 'paidAt')) {
                $table->date('paidAt')->nullable()->after('paidAmount');
            }
            if (!Schema::hasColumn('installments', 'paymentMethod')) {
                $table->string('paymentMethod', 30)->nullable()->after('paidAt');
            }
            if (!Schema::hasColumn('installments', 'recordedBy')) {
                $table->string('recordedBy')->nullable()->after('paymentMethod');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('installments', function (Blueprint $table) {
            $table->dropColumn(['paidAmount', 'paidAt', 'paymentMethod', 'recordedBy']);
        });
    }
};