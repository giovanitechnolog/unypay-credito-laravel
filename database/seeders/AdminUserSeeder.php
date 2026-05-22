<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $admins = [
            [
                'email' => 'admin@unypay.com',
                'name'  => 'Administrador UnyPay',
            ],
            [
                'email' => 'rafael.carvalho@technolog.com.br',
                'name'  => 'Rafael Carvalho',
            ],
        ];

        foreach ($admins as $admin) {
            User::updateOrCreate(
                ['email' => $admin['email']],
                [
                    'openId'       => (string) Str::uuid(),
                    'name'         => $admin['name'],
                    'password'     => '12345678',
                    'loginMethod'  => 'password',
                    'role'         => 'admin',
                    'lastSignedIn' => now(),
                ]
            );
        }
    }
}
