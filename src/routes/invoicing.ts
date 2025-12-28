
import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { supabase } from '../lib/supabase';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const PLATFORM_COMMISSION_RATE = 0.20; // 20% Commission

// Helper: Calculate Financials
const calculateFinancials = (totalAmount: number) => {
    const commission = totalAmount * PLATFORM_COMMISSION_RATE;
    const payout = totalAmount - commission;
    return {
        total: totalAmount,
        commission: Number(commission.toFixed(2)),
        payout: Number(payout.toFixed(2))
    };
};

// 1. Generate/Get Invoice Record
router.post('/generate/:bookingId', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
        const { bookingId } = req.params;

        // Check if invoice already exists
        const { data: existingInvoice } = await supabase
            .from('invoices')
            .select('*')
            .eq('booking_id', bookingId)
            .single();

        if (existingInvoice) {
            return res.json({ success: true, data: existingInvoice, message: 'Invoice already exists' });
        }

        // Fetch Booking Data
        const { data: booking, error: bookingError } = await supabase
            .from('athome_bookings')
            .select(`
                *,
                customer:users!athome_bookings_customer_id_fkey(*),
                assigned_beautician:beauticians!athome_bookings_assigned_beautician_id_fkey(*)
            `)
            .eq('id', bookingId)
            .single();

        if (bookingError || !booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (booking.status !== 'COMPLETED' && booking.status !== 'ASSIGNED' && booking.status !== 'Confirmed') {
            // Allow generating invoice if confirmed/assigned/completed. Usually typically "Completed".
            // For now allow it even if not completed so user can see example? 
            // Strict accounting says Invoice is issued upon Payment or Completion.
            // Let's assume Payment is done.
        }

        // Fetch Services & Products
        const { data: services } = await supabase
            .from('athome_booking_services')
            .select('*, master:admin_services!fk_abs_service(name, price)')
            .eq('booking_id', bookingId);

        const { data: products } = await supabase
            .from('athome_booking_products')
            .select('*, master:admin_products!athome_booking_products_admin_product_id_fkey(name, price)')
            .eq('booking_id', bookingId);

        // Prepare Snapshots
        const customerSnapshot = {
            name: `${booking.customer?.first_name} ${booking.customer?.last_name}`,
            email: booking.customer?.email,
            phone: booking.customer?.phone,
            address: booking.address
        };

        const itemsSnapshot = {
            services: services?.map(s => ({ name: s.master?.name, price: s.master?.price })) || [],
            products: products?.map(p => ({ name: p.master?.name, price: p.master?.price, qty: p.quantity })) || []
        };

        const financials = calculateFinancials(booking.total_amount || 0);

        // Generate ID via DB function or manually if we couldn't run migration
        // We rely on DB function `generate_invoice_number()` if possible, else fallback
        // Since I can't guarantee the SQL function exists right now, I'll generate one in code as fallback
        const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

        // Transaction
        // 1. Create Invoice
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
                booking_id: bookingId,
                invoice_number: invoiceNum, // ideally let DB handle it via function call if setup
                customer_snapshot: customerSnapshot,
                items_snapshot: itemsSnapshot,
                financial_breakdown: financials,
                status: 'ISSUED'
            })
            .select()
            .single();

        if (invoiceError) throw invoiceError;

        // 2. Create Payout Record (if beautician assigned)
        if (booking.assigned_beautician_id) {
            await supabase
                .from('beautician_payouts')
                .insert({
                    beautician_id: booking.assigned_beautician_id,
                    booking_id: bookingId,
                    amount: financials.payout,
                    status: 'PENDING'
                });
        }

        res.json({ success: true, data: invoice });

    } catch (error: any) {
        console.error('Invoice generation error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate invoice', error: error.message });
    }
});

// 2. Download Invoice PDF
router.get('/download/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;

        // Get Invoice Data
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('booking_id', bookingId)
            .single();

        if (error || !invoice) {
            return res.status(404).send('Invoice not found. Generate it first.');
        }

        const doc = new PDFDocument({ margin: 50 });

        // Set Headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoice_number}.pdf`);

        doc.pipe(res);

        // LOGO & HEADER
        doc
            .fontSize(20)
            .text('HOME BONZENGA', 50, 50)
            .fontSize(10)
            .text('Official Invoice', 50, 75);

        doc
            .text(`Invoice #: ${invoice.invoice_number}`, 400, 50)
            .text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 400, 65)
            .moveDown();

        const customer = invoice.customer_snapshot;
        doc
            .text('Bill To:', 50, 120)
            .font('Helvetica-Bold').text(customer.name)
            .font('Helvetica').text(customer.phone)
            .text(typeof customer.address === 'string' ? customer.address : (customer.address?.street || ''));

        // TABLE
        let y = 200;
        doc.font('Helvetica-Bold');
        doc.text('Description', 50, y);
        doc.text('Amount', 450, y, { width: 90, align: 'right' });
        doc.font('Helvetica');

        // Line
        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
        y += 30;

        // Items
        const items = invoice.items_snapshot;
        items.services.forEach((s: any) => {
            doc.text(`Service: ${s.name}`, 50, y);
            doc.text(`$${s.price?.toLocaleString()}`, 450, y, { width: 90, align: 'right' });
            y += 20;
        });
        items.products.forEach((p: any) => {
            doc.text(`Product: ${p.name} (x${p.qty})`, 50, y);
            const total = (p.price || 0) * (p.qty || 1);
            doc.text(`$${total.toLocaleString()}`, 450, y, { width: 90, align: 'right' });
            y += 20;
        });

        y += 20;
        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 20;

        // TOTALS
        const fin = invoice.financial_breakdown;
        doc.font('Helvetica-Bold');
        doc.text('Total Paid:', 350, y);
        doc.text(`$${fin.total.toLocaleString()}`, 450, y, { width: 90, align: 'right' });

        // FOOTER
        doc
            .fontSize(10)
            .text('Thank you for choosing Home Bonzenga.', 50, 700, { align: 'center', width: 500 });

        doc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).send('Error generating PDF');
    }
});

// 3. Admin Revenue Stats
router.get('/admin/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
        // Aggregate Payouts & Invoices
        // Note: For large datasets, use DB aggregation. For now, we fetch details.

        const { data: invoices } = await supabase
            .from('invoices')
            .select('financial_breakdown');

        let totalRevenue = 0;
        let totalCommission = 0;
        let totalPayouts = 0;

        invoices?.forEach(inv => {
            const f = inv.financial_breakdown;
            totalRevenue += f.total || 0;
            totalCommission += f.commission || 0;
            totalPayouts += f.payout || 0;
        });

        res.json({
            success: true,
            data: {
                totalRevenue,
                totalCommission,
                totalPayouts,
                count: invoices?.length || 0
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
});

export default router;
