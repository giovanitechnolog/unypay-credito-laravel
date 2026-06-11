<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

/**
 * 🚀 Configuração de Integração Externa.
 *
 * Cada linha representa um endpoint que o sistema consome (Rodopar SIGx,
 * ReceitaWS, ViaCEP, etc.) com suas credenciais. As credenciais são
 * armazenadas criptografadas — o `apiKey`, `apiSecret` e `password` ficam
 * em ciphertext no MySQL e Laravel decifra automaticamente ao acessar.
 *
 * `apiKeyMasked` é exposto no JSON para que o frontend mostre apenas algo
 * como `rede_***...e9` na grade, sem revelar a credencial completa.
 */
class Integration extends Model
{
    public static $snakeAttributes = false;

    protected $table = 'integrations';

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $fillable = [
        'name',
        'type',
        'environment',
        'baseUrl',
        'testEndpoint',
        'authType',
        'apiKey',
        'apiSecret',
        'username',
        'password',
        'extraHeaders',
        'description',
        'isActive',
        'lastTestedAt',
        'lastTestStatus',
        'lastTestMessage',
        'lastTestHttpCode',
    ];

    protected $casts = [
        'apiKey'           => 'encrypted',
        'apiSecret'        => 'encrypted',
        'password'         => 'encrypted',
        'extraHeaders'     => 'array',
        'isActive'         => 'boolean',
        'lastTestedAt'     => 'datetime',
        'lastTestHttpCode' => 'integer',
    ];

    /**
     * Esconde os segredos do JSON serializado por padrão. Para usá-los
     * no backend (ex: quando o controller dispara o teste de conexão),
     * acesse os atributos diretamente — eles continuam disponíveis no
     * Model, só não vão para o JSON enviado ao frontend.
     */
    protected $hidden = [
        'apiKey',
        'apiSecret',
        'password',
    ];

    /**
     * Atributos calculados que aparecem no JSON. `apiKeyMasked` permite
     * que a grade mostre uma versão truncada da credencial (`rede_xxxxxx`)
     * sem expor a chave completa para o navegador.
     */
    protected $appends = ['apiKeyMasked'];

    /**
     * Versão mascarada da apiKey para exibição na grade.
     *
     * Estratégia: mantém os primeiros 4 e os últimos 2 caracteres,
     * substituindo o miolo por `***`. Para chaves muito curtas (≤ 6
     * caracteres) devolvemos `***` para evitar revelar a maior parte.
     */
    protected function apiKeyMasked(): Attribute
    {
        return Attribute::get(function (): ?string {
            $key = $this->apiKey;
            if (!is_string($key) || $key === '') {
                return null;
            }
            $len = strlen($key);
            if ($len <= 6) {
                return '***';
            }
            return substr($key, 0, 4) . '***' . substr($key, -2);
        });
    }
}
