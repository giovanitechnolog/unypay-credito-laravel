<?php

namespace App\Http\Requests\Users;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Normaliza campos com máscara antes da validação.
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
        $userId = $this->route('user')?->id ?? $this->route('user');

        return [
            'name'      => ['required', 'string', 'max:255'],
            'email'     => [
                'required', 'string', 'email', 'max:320',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'document'  => [
                'nullable', 'string', 'max:20',
                Rule::unique('users', 'document')->ignore($userId),
            ],
            'birthDate' => ['nullable', 'date', 'before:today'],
            'phone'     => ['nullable', 'string', 'max:25'],
            // Senha opcional na edição — só atualiza se vier preenchida,
            // mas quando vier deve casar com a confirmação enviada.
            'password'              => ['nullable', 'string', 'confirmed', Password::min(8)],
            'password_confirmation' => ['nullable', 'string', 'required_with:password'],
            // Foto opcional na edição — mantém a atual se não enviar.
            'photo'     => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'role'      => ['sometimes', 'in:user,admin'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique'                       => 'Já existe um usuário com este e-mail.',
            'document.unique'                    => 'Já existe um usuário com este documento.',
            'birthDate.date'                     => 'Informe uma data de nascimento válida.',
            'birthDate.before'                   => 'A data de nascimento deve ser anterior a hoje.',
            'password.min'                       => 'A senha deve ter no mínimo 8 caracteres.',
            'password.confirmed'                 => 'A confirmação de senha não confere.',
            'password_confirmation.required_with' => 'Confirme a nova senha.',
            'photo.image'                        => 'O arquivo enviado precisa ser uma imagem.',
            'photo.mimes'                        => 'Formatos aceitos: JPG, JPEG, PNG ou WEBP.',
            'photo.max'                          => 'A imagem deve ter no máximo 4MB.',
        ];
    }
}
