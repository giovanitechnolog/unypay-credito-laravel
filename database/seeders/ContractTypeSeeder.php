<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB; // 👈 Importação mestre que cura o erro de tipo indefinido

class ContractTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $types = [
            ['name' => 'Confissão de Dívida', 'slug' => 'confissao-divida'],
            ['name' => 'Mútuo', 'slug' => 'mutuo'],
            ['name' => 'Aditivo DIP', 'slug' => 'aditivo-dip'],
        ];

        foreach ($types as $type) {
            DB::table('contract_types')->updateOrInsert(
                ['slug' => $type['slug']], // Chave de busca para não duplicar
                [
                    'name' => $type['name'],
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );
        }
    }
}