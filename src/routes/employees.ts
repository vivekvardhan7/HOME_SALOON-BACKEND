import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticate } from '../middleware/auth';
import { checkVendorApproved } from '../middleware/vendorApproval';

const router = Router();

// Get all employees for a vendor
router.get('/:vendorId/employees', authenticate, async (req, res) => {
  try {
    const { vendorId: userId } = req.params;
    console.log(`📥 GET /api/vendor/${userId}/employees - Fetching employees`);

    // Find the vendor record for this user
    const { data: vendor, error: vendorError } = await supabase
      .from('vendor')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (vendorError || !vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false });

    if (employeesError) throw employeesError;

    console.log(`✅ Found ${employees?.length || 0} employees`);

    // Transform to camelCase
    const transformedEmployees = (employees || []).map((e: any) => ({
      ...e,
      vendorId: e.vendor_id,
      createdAt: e.created_at,
      totalBookings: e.total_bookings || 0
    }));

    res.json({ employees: transformedEmployees });
  } catch (error) {
    console.error('❌ Error fetching employees:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new employee
router.post('/:vendorId/employees', authenticate, checkVendorApproved, async (req, res) => {
  try {
    const { vendorId: userId } = req.params;
    const { name, role, email, phone, experience, specialization } = req.body;
    console.log(`📥 POST /api/vendor/${userId}/employees - Creating employee`);

    // Find the vendor record for this user
    const { data: vendor, error: vendorError } = await supabase
      .from('vendor')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (vendorError || !vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const { data: employee, error: createError } = await supabase
      .from('employees')
      .insert({
        vendor_id: vendor.id,
        name,
        role,
        email,
        phone,
        experience: parseInt(experience) || 0,
        specialization: specialization || null,
        status: 'ACTIVE',
        rating: 0,
        total_bookings: 0
      })
      .select()
      .single();

    if (createError) throw createError;

    console.log(`✅ Employee created: ${employee.id}`);

    // Transform to camelCase
    const transformedEmployee = {
      ...employee,
      vendorId: employee.vendor_id,
      createdAt: employee.created_at,
      totalBookings: employee.total_bookings || 0
    };

    res.status(201).json({ employee: transformedEmployee });
  } catch (error) {
    console.error('❌ Error creating employee:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update employee
router.put('/:vendorId/employees/:employeeId', authenticate, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { name, role, email, phone, experience, specialization, status } = req.body;
    console.log(`📥 PUT /api/vendor/.../employees/${employeeId} - Updating employee`);

    const { data: employee, error: updateError } = await supabase
      .from('employees')
      .update({
        name,
        role,
        email,
        phone,
        experience: parseInt(experience) || 0,
        specialization: specialization || null,
        status: status || 'ACTIVE'
      })
      .eq('id', employeeId)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log(`✅ Employee updated: ${employee.id}`);

    // Transform to camelCase
    const transformedEmployee = {
      ...employee,
      vendorId: employee.vendor_id,
      createdAt: employee.created_at,
      totalBookings: employee.total_bookings || 0
    };

    res.json({ employee: transformedEmployee });
  } catch (error) {
    console.error('❌ Error updating employee:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete employee
router.delete('/:vendorId/employees/:employeeId', authenticate, async (req, res) => {
  try {
    const { employeeId } = req.params;
    console.log(`📥 DELETE /api/vendor/.../employees/${employeeId} - Deleting employee`);

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId);

    if (error) throw error;

    console.log(`✅ Employee deleted: ${employeeId}`);
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting employee:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single employee
router.get('/:vendorId/employees/:employeeId', authenticate, async (req, res) => {
  try {
    const { employeeId } = req.params;
    console.log(`📥 GET /api/vendor/.../employees/${employeeId} - Fetching employee`);

    const { data: employee, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (error || !employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    console.log(`✅ Employee found: ${employee.id}`);

    // Transform to camelCase
    const transformedEmployee = {
      ...employee,
      vendorId: employee.vendor_id,
      createdAt: employee.created_at,
      totalBookings: employee.total_bookings || 0
    };

    res.json({ employee: transformedEmployee });
  } catch (error) {
    console.error('❌ Error fetching employee:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
