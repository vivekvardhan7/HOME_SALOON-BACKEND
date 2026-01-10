
/**
 * Standardized Financial Calculation Method
 * 
 * Rules:
 * 1. VAT is 16% of Base Price.
 * 2. Total = Base + VAT (Base * 1.16).
 * 3. Platform Commission = 15% of Base Price.
 * 4. Vendor/Beautician Payout = 85% of Base Price.
 */

export interface FinancialBreakdown {
    baseAmount: number;
    vatAmount: number;
    totalAmount: number;
    platformCommission: number;
    vendorPayout: number;
}

/**
 * Calculates financials given a BASE amount (e.g. Service Price from Catalog).
 * Use this when adding items to a cart where prices are pre-tax.
 * @param baseAmount The sum of service/product base prices.
 */
export const calculateFromBase = (baseAmount: number): FinancialBreakdown => {
    const base = Math.max(0, Number(baseAmount) || 0);
    const vat = base * 0.16;
    const total = base + vat;

    return {
        baseAmount: Number(base.toFixed(2)),
        vatAmount: Number(vat.toFixed(2)),
        totalAmount: Number(total.toFixed(2)),
        platformCommission: Number((base * 0.15).toFixed(2)),
        vendorPayout: Number((base * 0.85).toFixed(2))
    };
};

/**
 * Calculates financials given an ENTERED amount (At-Salon) which is treated as the BASE amount.
 * Example: Vendor enters 100.
 * Base = 100.
 * VAT = 16.
 * Total to Pay = 116.
 * @param enteredAmount The amount entered by the vendor (Base Price).
 */
export const calculateFromTotal = (enteredAmount: number): FinancialBreakdown => {
    const base = Math.max(0, Number(enteredAmount) || 0);
    const vat = base * 0.16;
    const total = base + vat;

    return {
        baseAmount: Number(base.toFixed(2)),
        vatAmount: Number(vat.toFixed(2)),
        totalAmount: Number(total.toFixed(2)),
        platformCommission: Number((base * 0.15).toFixed(2)),
        vendorPayout: Number((base * 0.85).toFixed(2))
    };
};
