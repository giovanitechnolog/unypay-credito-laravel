<?php

namespace App\Http\Requests\Auth;

use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email'    => ['required', 'string', 'email', 'max:320'],
            'password' => ['required', 'string', 'min:6'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required'    => 'Informe o e-mail.',
            'email.email'       => 'Informe um e-mail válido.',
            'password.required' => 'Informe a senha.',
        ];
    }

    /**
     * Tenta autenticar o usuário respeitando o rate limit "login".
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $credentials = [
            'email'    => $this->string('email')->trim()->lower()->toString(),
            'password' => $this->string('password')->toString(),
        ];

        if (! Auth::attempt($credentials)) {
            RateLimiter::hit($this->throttleKey(), 60);

            throw ValidationException::withMessages([
                'email' => 'As credenciais informadas não conferem.',
            ]);
        }

        $user = Auth::user();

        if ($user && ! $user->isActive()) {
            Auth::logout();

            throw ValidationException::withMessages([
                'email' => EnsureUserIsActive::INACTIVE_MESSAGE,
            ]);
        }

        RateLimiter::clear($this->throttleKey());

        // Atualiza o último login (campo customizado existente no schema).
        if ($user) {
            $user->forceFill(['lastSignedIn' => now()])->saveQuietly();
        }
    }

    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => "Muitas tentativas de login. Tente novamente em {$seconds} segundos.",
        ]);
    }

    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->string('email')).'|'.$this->ip());
    }
}
