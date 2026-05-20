<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contractId')->nullable()->constrained('contracts')->onDelete('set null');
            $table->foreignId('clientId')->nullable()->constrained('clients')->onDelete('set null');
            $table->string('attachmentType', 50)->default('contract_pdf');
            $table->string('originalName', 255);
            $table->string('storageKey', 512);
            $table->string('storageUrl', 512);
            $table->string('mimeType', 100)->nullable();
            $table->bigInteger('fileSize')->nullable();
            $table->text('notes')->nullable();
            $table->string('uploadedBy', 255)->nullable();
            $table->timestamp('createdAt')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attachments');
    }
};