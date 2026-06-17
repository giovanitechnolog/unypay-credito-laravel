<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE users MODIFY lastSignedIn TIMESTAMP NULL DEFAULT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE users MODIFY lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
    }
};
