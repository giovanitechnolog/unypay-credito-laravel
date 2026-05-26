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
            'password' => ['required', 'string', Password::min(8)],
            'photo'    => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'role'     => ['sometimes', 'in:user,admin'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'     => 'Informe o nome.',
            'email.required'    => 'Informe o e-mail.',
            'email.email'       => 'Informe um e-mail válido.',
            'email.unique'      => 'Já existe um usuário com este e-mail.',
            'password.required' => 'Informe a senha.',
            'password.min'      => 'A senha deve ter no mínimo 8 caracteres.',
            'photo.required'    => 'Envie a foto do usuário.',
            'photo.image'       => 'O arquivo enviado precisa ser uma imagem.',
            'photo.mimes'       => 'Formatos aceitos: JPG, JPEG, PNG ou WEBP.',
            'photo.max'         => 'A imagem deve ter no máximo 4MB.',
        ];
    }
}
