<?php

namespace App\Http\Requests\Users;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'string', 'email', 'max:320', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', Password::min(8)],
            'role'     => ['sometimes', 'in:user,admin'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'      => 'Informe o nome.',
            'email.required'     => 'Informe o e-mail.',
            'email.email'        => 'Informe um e-mail válido.',
            'email.unique'       => 'Já existe um usuário com este e-mail.',
            'password.required'  => 'Informe a senha.',
            'password.confirmed' => 'A confirmação de senha não confere.',
            'password.min'       => 'A senha deve ter no mínimo 8 caracteres.',
        ];
    }
}
