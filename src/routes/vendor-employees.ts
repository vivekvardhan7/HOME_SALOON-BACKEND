import { Router, Response } from "express";
import { supabase } from "../lib/supabase";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// ----------------------------------------------------------------------
// GET EMPLOYEES
// ----------------------------------------------------------------------
router.get("/:vendorId/employees", authenticate, async (req: AuthenticatedRequest, res: Response) => {
    // 1. Get authenticated user ID
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    // 2. Resolve vendor_id from vendor table
    const { data: vendor, error: vendorError } = await supabase
        .from("vendor")
        .select("id")
        .eq("user_id", userId)
        .single();

    if (vendorError || !vendor) {
        console.error("Vendor lookup failed:", vendorError);
        console.log(`Debug: User ID ${userId} has no vendor row.`);
        return res.status(400).json({ message: "Vendor profile not found" });
    }

    const vendorId = vendor.id; // ✅ THIS is vendor_id
    console.log(`Debug: Mapped User ${userId} -> Vendor ${vendorId}`);

    // ✅ FETCH EMPLOYEES (NO URL TRUST)
    const { data, error } = await supabase
        .from("vendor_employees")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Fetch employees error:", error);
        return res.status(400).json({ message: error.message });
    }

    return res.status(200).json(data || []);
});

// ----------------------------------------------------------------------
// ADD EMPLOYEE
// ----------------------------------------------------------------------
router.post("/:vendorId/employees", authenticate, async (req: AuthenticatedRequest, res: Response) => {
    console.log("POST /api/vendor/:id/employees HIT");
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // 1. Validate Input
    const { name, role, email, phone, experience_years, specialization } = req.body;
    if (!name || !role) {
        return res.status(400).json({ message: "Name and role are required" });
    }

    // 2. Resolve Vendor Securely
    const { data: vendor, error: vendorError } = await supabase
        .from("vendor")
        .select("id")
        .eq("user_id", userId)
        .single();

    if (vendorError || !vendor) {
        return res.status(400).json({ message: "Vendor profile not found" });
    }

    const vendorId = vendor.id;

    // 3. Insert Employee (using correct table and fields)
    const { data: newEmployee, error: insertError } = await supabase
        .from("vendor_employees")
        .insert({
            vendor_id: vendorId,
            name,
            role,
            email,
            phone,
            experience_years,
            specialization,
            is_active: true
        })
        .select()
        .single();

    if (insertError) {
        console.error("Create employee error:", insertError);
        return res.status(400).json({ message: insertError.message });
    }

    return res.status(201).json(newEmployee);
});

// ----------------------------------------------------------------------
// DELETE EMPLOYEE
// ----------------------------------------------------------------------
router.delete("/employees/:employeeId", authenticate, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { employeeId } = req.params;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { data: vendor, error: vendorError } = await supabase
        .from("vendor")
        .select("id")
        .eq("user_id", userId)
        .single();

    if (vendorError || !vendor) {
        return res.status(400).json({ message: "Vendor profile not found" });
    }

    const { error: deleteError } = await supabase
        .from("vendor_employees")
        .delete()
        .eq("id", employeeId)
        .eq("vendor_id", vendor.id);

    if (deleteError) {
        return res.status(400).json({ message: deleteError.message });
    }

    return res.json({ message: "Employee deleted successfully" });
});

export default router;
