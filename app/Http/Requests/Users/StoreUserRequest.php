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

    /**
     * Normaliza os campos com máscara (CPF/CNPJ e telefone) antes da validação,
     * mantendo o banco com o formato exibido na UI e evitando divergências.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'document' => $this->filled('document') ? trim((string) $this->input('document')) : null,
            'phone'    => $this->filled('phone')    ? trim((string) $this->input('phone'))    : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'name'                  => ['required', 'string', 'max:255'],
            'email'                 => ['required', 'string', 'email', 'max:320', 'unique:users,email'],
            'document'              => ['nullable', 'string', 'max:20', 'unique:users,document'],
            'birthDate'             => ['nullable', 'date', 'before:today'],
            'phone'                 => ['nullable', 'string', 'max:25'],
            'password'              => ['required', 'string', 'confirmed', Password::min(8)],
            'password_confirmation' => ['required', 'string'],
            'photo'                 => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'role'                  => ['sometimes', 'in:user,admin'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'                  => 'Informe o nome completo.',
            'email.required'                 => 'Informe o e-mail.',
            'email.email'                    => 'Informe um e-mail válido.',
            'email.unique'                   => 'Já existe um usuário com este e-mail.',
            'document.unique'                => 'Já existe um usuário com este documento.',
            'birthDate.date'                 => 'Informe uma data de nascimento válida.',
            'birthDate.before'               => 'A data de nascimento deve ser anterior a hoje.',
            'password.required'              => 'Informe a senha.',
            'password.min'                   => 'A senha deve ter no mínimo 8 caracteres.',
            'password.confirmed'             => 'A confirmação de senha não confere.',
            'password_confirmation.required' => 'Confirme a nova senha.',
            'photo.required'                 => 'Envie a foto do usuário.',
            'photo.image'                    => 'O arquivo enviado precisa ser uma imagem.',
            'photo.mimes'                    => 'Formatos aceitos: JPG, JPEG, PNG ou WEBP.',
            'photo.max'                      => 'A imagem deve ter no máximo 4MB.',
        ];
    }
}
