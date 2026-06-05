<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contract_witnesses', function (Blueprint $table) {
            $table->string('ci', 50)->nullable()->after('cpf');
        });
    }

    public function down(): void
    {
        Schema::table('contract_witnesses', function (Blueprint $table) {
            $table->dropColumn('ci');
        });
    }
};
