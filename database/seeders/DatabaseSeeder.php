<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            AdminUserSeeder::class,
        ]);

        $this->call([
            ContractTypeSeeder::class,
        ]);

        $this->call([
            ContractTypeSeeder::class, // Tipos (Mútuo, Consignado...)
            LoadContractsDataSeeder::class, // 👈 Nova Linha Injetada Aqui!
        ]);

    }
}
