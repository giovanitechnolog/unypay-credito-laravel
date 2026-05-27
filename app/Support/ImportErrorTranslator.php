<?php

namespace App\Support;

use App\Imports\Sheets\BaseParcelasSheet;
use App\Imports\Sheets\RegrasContratuaisSheet;
use Maatwebsite\Excel\Exceptions\NoTypeDetectedException;
use Maatwebsite\Excel\Exceptions\SheetNotFoundException;
use Maatwebsite\Excel\Exceptions\UnreadableFileException;
use Throwable;

/**
 * Converte exceções técnicas (geralmente em inglês) lançadas durante o
 * import da planilha de contratos em mensagens amigáveis em PT-BR para
 * exibir ao usuário final na UI.
 */
class ImportErrorTranslator
{
    public static function friendly(Throwable $e): string
    {
        $required = '"' . RegrasContratuaisSheet::SHEET_NAME . '" e "' . BaseParcelasSheet::SHEET_NAME . '"';

        if ($e instanceof SheetNotFoundException) {
            return 'A planilha enviada não está no formato esperado. '
                . 'Verifique se o arquivo contém as abas obrigatórias '
                . $required . ' com os cabeçalhos na linha 3.';
        }

        if ($e instanceof NoTypeDetectedException || $e instanceof UnreadableFileException) {
            return 'Não foi possível ler o arquivo enviado. '
                . 'Confirme que é um arquivo Excel (.xlsx, .xls) ou CSV válido '
                . 'e que não está corrompido.';
        }

        $msg = (string) $e->getMessage();

        if (
            str_contains($msg, 'out of bounds')
            || str_contains($msg, 'requested sheet')
            || str_contains($msg, 'Sheet index')
        ) {
            return 'A planilha enviada não está no formato esperado. '
                . 'Verifique se o arquivo contém as abas obrigatórias ' . $required . '.';
        }

        if (
            str_contains($msg, 'File type could not be determined')
            || str_contains($msg, 'is not recognised')
            || str_contains($msg, 'could not open for reading')
            || str_contains($msg, 'Invalid file')
            || str_contains($msg, 'Reader_Exception')
        ) {
            return 'Não foi possível ler o arquivo enviado. '
                . 'Confirme que é um arquivo Excel (.xlsx, .xls) ou CSV válido '
                . 'e que não está corrompido.';
        }

        return 'Não foi possível processar a planilha. '
            . 'Verifique se o arquivo está no formato correto (.xlsx, .xls ou .csv) '
            . 'e contém as abas ' . $required . '.';
    }
}
