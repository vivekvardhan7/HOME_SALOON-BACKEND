
import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Secure all routes in this file
router.use(authenticate);
router.use(authorize(['ADMIN']));

// ==================== ADMIN BEAUTICIAN MANAGEMENT ====================

// 1. List All Beauticians
router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
        const { data: beauticians, error } = await supabase
            .from('beauticians')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data: beauticians });
    } catch (error: any) {
        console.error('Error fetching beauticians:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch beauticians', error: error.message });
    }
});

// 2. Add New Beautician
router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
        const { name, email, phone, skills, expert_level, profile_image } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ success: false, message: 'Name and Phone are required.' });
        }

        // Process skills: If it's a string, convert to array to satisfy potential text[] column
        let processedSkills = skills;
        if (typeof skills === 'string') {
            // Check if it looks like a comma-separated list
            processedSkills = skills.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        }

        const { data, error } = await supabase
            .from('beauticians')
            .insert([{
                name,
                email,
                phone,
                skills: processedSkills,
                expert_level: expert_level || 'Intermediate',
                status: 'ACTIVE',
                profile_image,
                created_by_admin: req.user!.id
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data, message: 'Beautician added successfully.' });
    } catch (error: any) {
        console.error('Error adding beautician:', error);
        res.status(500).json({ success: false, message: 'Failed to add beautician', error: error.message });
    }
});

// 3. Update Beautician
router.put('/:id', async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const { data, error } = await supabase
            .from('beauticians')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data, message: 'Beautician updated successfully.' });
    } catch (error: any) {
        console.error('Error updating beautician:', error);
        res.status(500).json({ success: false, message: 'Failed to update beautician', error: error.message });
    }
});

// 4. Delete/Deactivate Beautician
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;

        // Soft delete usually perferred, but user said "manage CRUD"
        const { error } = await supabase
            .from('beauticians')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Beautician deleted successfully.' });
    } catch (error: any) {
        console.error('Error deleting beautician:', error);
        res.status(500).json({ success: false, message: 'Failed to delete beautician', error: error.message });
    }
});

export default router;
