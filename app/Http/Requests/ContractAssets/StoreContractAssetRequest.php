<?php

namespace App\Http\Requests\ContractAssets;

use App\Models\ContractAsset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Valida UM bem em garantia (veículo ou imóvel).
 *
 * 💡 Uso na prática:
 *   1. Como FormRequest tradicional, em uma rota dedicada (ex.:
 *      POST /api/contracts/{id}/assets) — útil para testes isolados.
 *   2. Como provedor de regras estáticas para o ContractController, que
 *      recebe um array `assets[]` dentro do payload do contrato e
 *      monta as rules dinamicamente para cada índice (assets.0, assets.1...).
 *
 * Os métodos estáticos `rulesFor`, `messagesFor` e `normalize` foram
 * extraídos justamente para que o controller os reutilize sem ter que
 * instanciar este FormRequest manualmente.
 */
class StoreContractAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Normaliza placa, RENAVAM e chassi (uppercase / só dígitos) antes de validar.
     */
    protected function prepareForValidation(): void
    {
        $this->merge(self::normalize($this->all()));
    }

    public function rules(): array
    {
        return self::rulesFor($this->input('assetType'));
    }

    public function messages(): array
    {
        return self::messagesFor();
    }

    /**
     * 🚀 Regra-mãe reutilizável.
     *
     * Recebe o assetType e devolve o array de regras correspondente.
     * O parâmetro $prefix permite que o ContractController aplique as mesmas
     * regras em "assets.0", "assets.1", etc.
     */
    public static function rulesFor(?string $assetType, string $prefix = ''): array
    {
        $isVehicle    = $assetType === ContractAsset::TYPE_VEHICLE;
        $isRealEstate = $assetType === ContractAsset::TYPE_REAL_ESTATE;

        $p = $prefix === '' ? '' : rtrim($prefix, '.') . '.';

        return [
            "{$p}assetType" => [
                'required',
                Rule::in([ContractAsset::TYPE_VEHICLE, ContractAsset::TYPE_REAL_ESTATE]),
            ],

            // ID opcional — presente apenas em update (estratégia diff manual).
            "{$p}id"               => ['nullable', 'integer', 'exists:contract_assets,id'],

            // ── Veículos ───────────────────────────────────────────────────
            "{$p}brand"            => [Rule::requiredIf($isVehicle), 'nullable', 'string', 'max:80'],
            "{$p}model"            => [Rule::requiredIf($isVehicle), 'nullable', 'string', 'max:120'],
            "{$p}manufactureYear"  => ['nullable', 'integer', 'min:1900', 'max:2100'],
            "{$p}modelYear"        => ['nullable', 'integer', 'min:1900', 'max:2100'],
            "{$p}plate"            => [Rule::requiredIf($isVehicle), 'nullable', 'string', 'max:10'],
            "{$p}renavam"          => ['nullable', 'string', 'max:20'],
            "{$p}chassis"          => [Rule::requiredIf($isVehicle), 'nullable', 'string', 'size:17'],

            // ── Imóveis ────────────────────────────────────────────────────
            "{$p}description"      => ['nullable', 'string'],
            "{$p}location"         => [Rule::requiredIf($isRealEstate), 'nullable', 'string', 'max:255'],
            "{$p}registryNumber"   => [Rule::requiredIf($isRealEstate), 'nullable', 'string', 'max:60'],
            "{$p}totalArea"        => [Rule::requiredIf($isRealEstate), 'nullable', 'numeric', 'min:0'],
            "{$p}boundaries"       => ['nullable', 'string'],
        ];
    }

    public static function messagesFor(string $prefix = ''): array
    {
        $p = $prefix === '' ? '' : rtrim($prefix, '.') . '.';

        return [
            "{$p}assetType.required" => 'Selecione o tipo do bem (Veículo ou Imóvel).',
            "{$p}assetType.in"       => 'Tipo de bem inválido.',

            "{$p}brand.required_if"   => 'Informe a marca do veículo.',
            "{$p}model.required_if"   => 'Informe o modelo do veículo.',
            "{$p}plate.required_if"   => 'Informe a placa do veículo.',
            "{$p}chassis.required_if" => 'Informe o chassi do veículo.',
            "{$p}chassis.size"        => 'O chassi (VIN) deve conter exatamente 17 caracteres.',

            "{$p}location.required_if"       => 'Informe a localização do imóvel.',
            "{$p}registryNumber.required_if" => 'Informe o número da matrícula no cartório.',
            "{$p}totalArea.required_if"      => 'Informe a área total do imóvel.',
            "{$p}totalArea.numeric"          => 'A área total deve ser numérica (m²).',
        ];
    }

    /**
     * 🚀 Normaliza UM bem (assetType, placa, RENAVAM, chassi, totalArea) antes
     * de validar/persistir. É idempotente: passar o resultado de novo aqui não
     * altera nada.
     *
     *   - assetType → lower-case e validado contra o enum;
     *   - plate / chassis → uppercase e sem espaços;
     *   - renavam → apenas dígitos;
     *   - totalArea → aceita "521,81 m²" e converte para 521.81 (float).
     */
    public static function normalize(array $asset): array
    {
        $type = strtolower((string) ($asset['assetType'] ?? ''));
        $asset['assetType'] = in_array($type, [
            ContractAsset::TYPE_VEHICLE,
            ContractAsset::TYPE_REAL_ESTATE,
        ], true) ? $type : null;

        if (!empty($asset['plate'])) {
            $asset['plate'] = strtoupper(preg_replace('/\s+/', '', (string) $asset['plate']));
        }
        if (!empty($asset['renavam'])) {
            $asset['renavam'] = preg_replace('/\D/', '', (string) $asset['renavam']);
        }
        if (!empty($asset['chassis'])) {
            $asset['chassis'] = strtoupper(preg_replace('/\s+/', '', (string) $asset['chassis']));
        }

        // totalArea — aceita "521,81 m²", "521.81", "521,81" e devolve float.
        if (isset($asset['totalArea']) && $asset['totalArea'] !== '' && $asset['totalArea'] !== null) {
            if (!is_numeric($asset['totalArea'])) {
                $cleaned = preg_replace('/[^\d,\.]/', '', (string) $asset['totalArea']);
                // Se houver tanto vírgula quanto ponto, considera vírgula como decimal e tira pontos (formato BR).
                if (substr_count($cleaned, ',') > 0 && substr_count($cleaned, '.') > 0) {
                    $cleaned = str_replace('.', '', $cleaned);
                }
                $cleaned = str_replace(',', '.', $cleaned);
                $asset['totalArea'] = is_numeric($cleaned) ? (float) $cleaned : null;
            } else {
                $asset['totalArea'] = (float) $asset['totalArea'];
            }
        }

        return $asset;
    }
}
