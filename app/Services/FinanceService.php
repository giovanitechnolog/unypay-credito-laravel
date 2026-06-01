<?php

namespace App\Services;

use Carbon\Carbon;

class FinanceService
{
    /**
     * Cálculo de juros reais pela fórmula Price (Substitui calcRealInterest)
     */
    public static function calcRealInterest(float $principal, float $monthlyRate, int $installmentCount, float $installmentAmount): array
    {
        if ($principal <= 0 || $installmentCount <= 0) {
            return ['totalInterest' => 0.0, 'totalPayable' => $principal, 'effectiveRate' => 0.0];
        }

        if ($monthlyRate > 0) {
            $r = $monthlyRate;
            $pmt = $installmentAmount > 0 
                ? $installmentAmount 
                : ($principal * $r * pow(1 + $r, $installmentCount)) / (pow(1 + $r, $installmentCount) - 1);
            
            $totalPayable = $pmt * $installmentCount;
            $totalInterest = $totalPayable - $principal;

            return [
                'totalInterest' => max(0.0, round($totalInterest, 2)),
                'totalPayable' => round($totalPayable, 2),
                'effectiveRate' => $monthlyRate,
            ];
        }

        $totalPayable = $installmentAmount * $installmentCount;
        return [
            'totalInterest' => max(0.0, $totalPayable - $principal),
            'totalPayable' => $totalPayable,
            'effectiveRate' => 0.0,
        ];
    }

    /**
     * Calcula CET (Custo Efetivo Total) mensal por Newton-Raphson
     */
    public static function calcCETFromContract(float $principal, float $installmentAmount, int $installmentCount, float $tac, float $iof): array
    {
        $netPrincipal = $principal - $tac - $iof;
        if ($netPrincipal <= 0 || $installmentAmount <= 0) {
            return ['cetMonthly' => 0.0, 'cetAnnual' => 0.0];
        }

        $r = 0.02; // Chute inicial
        for ($iter = 0; $iter < 200; $iter++) {
            $pv = $installmentAmount * (1 - pow(1 + $r, -$installmentCount)) / $r;
            $dpv = $installmentAmount * (
                (pow(1 + $r, -$installmentCount) * $installmentCount / $r) -
                (1 - pow(1 + $r, -$installmentCount)) / ($r * $r)
            );
            
            if ($dpv == 0) break;

            $rNew = $r - ($pv - $netPrincipal) / $dpv;
            if (abs($rNew - $r) < 1e-10) {
                $r = $rNew;
                break;
            }
            $r = max(0.0001, $rNew);
        }

        return [
            'cetMonthly' => round($r, 6),
            'cetAnnual' => round(pow(1 + $r, 12) - 1, 6),
        ];
    }

    /**
     * Gera a tabela Price completa para um contrato
     */
    public static function generatePriceTable(float $principal, float $monthlyRate, int $installmentCount, float $installmentAmount, string $firstDueDate): array
    {
        if ($installmentCount <= 0 || $principal <= 0) return [];

        if ($monthlyRate <= 0) {
            $amort = $principal / $installmentCount;
            $rows = [];
            for ($i = 0; $i < $installmentCount; $i++) {
                $rows[] = [
                    'n' => $i + 1,
                    'dueDate' => Carbon::parse($firstDueDate)->addMonths($i)->toDateString(),
                    'payment' => $installmentAmount,
                    'interest' => 0.0,
                    'amortization' => round($amort, 2),
                    'balance' => max(0.0, round($principal - $amort * ($i + 1), 2)),
                    'cumulativeInterest' => 0.0,
                    'cumulativeAmortization' => round($amort * ($i + 1), 2),
                ];
            }
            return $rows;
        }

        $r = $monthlyRate;
        $pmt = ($principal * $r * pow(1 + $r, $installmentCount)) / (pow(1 + $r, $installmentCount) - 1);
        $actualPmt = $installmentAmount > 0 ? $installmentAmount : $pmt;

        $rows = [];
        $balance = $principal;
        $cumInterest = 0;
        $cumAmort = 0;

        for ($i = 0; $i < $installmentCount; $i++) {
            $interest = $balance * $r;
            $amortization = min($actualPmt - $interest, $balance);
            $payment = $i < $installmentCount - 1 ? $actualPmt : $balance + $interest;
            
            $balance = max(0.0, $balance - $amortization);
            $cumInterest += $interest;
            $cumAmort += $amortization;

            $rows[] = [
                'n' => $i + 1,
                'dueDate' => Carbon::parse($firstDueDate)->addMonths($i)->toDateString(),
                'payment' => round($payment, 2),
                'interest' => round($interest, 2),
                'amortization' => round($amortization, 2),
                'balance' => round($balance, 2),
                'cumulativeInterest' => round($cumInterest, 2),
                'cumulativeAmortization' => round($cumAmort, 2),
            ];
        }

        return $rows;
    }

    /**
     * 🚀 NOVO MÉTODO: MOTOR DE CORREÇÃO MONETÁRIA IPCA
     * Aplica o índice de inflação acumulado do período sobre a parcela pós-fixada.
     * * @param float $originalAmount Valor original calculado pela Price
     * @param string $indexType Tipo de correção mapeado no contrato (Ex: 'IPCA', 'IGPM', 'PRE')
     * @param float $ipcaRate Taxa do IPCA oficial informada ou vinda de API (Ex: 0.0045 para 0.45%)
     */
    public static function applyIpcaCorrection(float $originalAmount, string $indexType, float $ipcaRate): array
    {
        // Se o contrato for Pré-fixado ou não usar IPCA, mantém o valor original intacto
        if (strtoupper($indexType) !== 'IPCA' || $ipcaRate <= 0) {
            return [
                'isCorrected' => false,
                'originalAmount' => $originalAmount,
                'correctionValue' => 0.0,
                'updatedAmount' => $originalAmount
            ];
        }

        // Formula de Atualização Monetária Pós-Fixada de Mercado
        $correctionValue = $originalAmount * $ipcaRate;
        $updatedAmount = $originalAmount + $correctionValue;

        return [
            'isCorrected'     => true,
            'originalAmount'  => round($originalAmount, 2),
            'correctionValue' => round($correctionValue, 2), // O ganho real/inflacionário da UnyPay®
            'updatedAmount'   => round($updatedAmount, 2)    // O novo valor de face que o cliente vai pagar
        ];
    }
}