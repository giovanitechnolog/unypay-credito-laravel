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

    public function rules(): array
    {
        $userId = $this->route('user')?->id ?? $this->route('user');

        return [
            'name'     => ['required', 'string', 'max:255'],
            'email'    => [
                'required', 'string', 'email', 'max:320',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            // Senha opcional na edição — só atualiza se vier preenchida.
            'password' => ['nullable', 'string', Password::min(8)],
            // Foto opcional na edição — mantém a atual se não enviar.
            'photo'    => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'role'     => ['sometimes', 'in:user,admin'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Já existe um usuário com este e-mail.',
            'password.min' => 'A senha deve ter no mínimo 8 caracteres.',
            'photo.image'  => 'O arquivo enviado precisa ser uma imagem.',
            'photo.mimes'  => 'Formatos aceitos: JPG, JPEG, PNG ou WEBP.',
            'photo.max'    => 'A imagem deve ter no máximo 4MB.',
        ];
    }
}
