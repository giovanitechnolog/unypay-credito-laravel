<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // E-mail de redefinição de senha 100% em PT-BR.
        ResetPassword::toMailUsing(function ($notifiable, string $token) {
            $url = url(route('password.reset', [
                'token' => $token,
                'email' => $notifiable->getEmailForPasswordReset(),
            ], false));

            return (new MailMessage)
                ->subject('Redefinição de senha — UnyPay® Crédito')
                ->greeting('Olá!')
                ->line('Você está recebendo este e-mail porque solicitamos a redefinição de senha da sua conta.')
                ->action('Redefinir senha', $url)
                ->line('Este link expira em '.config('auth.passwords.users.expire').' minutos.')
                ->line('Se você não solicitou a redefinição, nenhuma ação é necessária.')
                ->salutation('Atenciosamente, Equipe UnyPay®');
        });
    }
}
