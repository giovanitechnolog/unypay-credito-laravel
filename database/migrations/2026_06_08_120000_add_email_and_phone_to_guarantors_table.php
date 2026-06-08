<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guarantors', function (Blueprint $table) {
            $table->string('email', 255)->nullable()->after('name');
            $table->string('phone', 20)->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('guarantors', function (Blueprint $table) {
            $table->dropColumn(['email', 'phone']);
        });
    }
};
