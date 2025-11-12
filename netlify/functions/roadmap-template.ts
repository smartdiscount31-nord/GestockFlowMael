/**
 * Roadmap Template Management
 * Create, update, and delete weekly recurring task templates
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('[RoadmapTemplate] Request:', event.httpMethod);

  // Get user from auth token
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[RoadmapTemplate] Missing authorization header');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.error('[RoadmapTemplate] Invalid token:', authError);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    if (event.httpMethod === 'POST') {
      return await createOrUpdateTemplate(supabase, user.id, event.body || '{}');
    } else if (event.httpMethod === 'DELETE') {
      return await deleteTemplate(supabase, user.id, event.queryStringParameters);
    } else {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }
  } catch (error) {
    console.error('[RoadmapTemplate] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Create or update a template
 */
async function createOrUpdateTemplate(supabase: any, userId: string, bodyStr: string) {
  const body = JSON.parse(bodyStr);
  const {
    id,
    day_of_week,
    title,
    start_time,
    end_time,
    position,
    active,
    propagate_future,
  } = body;

  console.log('[RoadmapTemplate] Create/update:', { id, day_of_week, title, propagate_future });

  if (!title || day_of_week === undefined) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: title, day_of_week' }),
    };
  }

  if (day_of_week < 1 || day_of_week > 7) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'day_of_week must be between 1 (Monday) and 7 (Sunday)' }),
    };
  }

  const today = new Date().toISOString().split('T')[0];

  // Upsert template
  const templateData: any = {
    user_id: userId,
    day_of_week,
    title,
    start_time: start_time || null,
    end_time: end_time || null,
    position: position !== undefined ? position : 0,
    active: active !== undefined ? active : true,
    applies_from: today,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    templateData.id = id;
  }

  const { data: template, error: templateError } = await supabase
    .from('roadmap_templates')
    .upsert(templateData)
    .select()
    .single();

  if (templateError) {
    console.error('[RoadmapTemplate] Error saving template:', templateError);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to save template' }),
    };
  }

  console.log('[RoadmapTemplate] Template saved:', template.id);

  // If propagate_future is true, update all future entries from this template
  if (propagate_future && id) {
    console.log('[RoadmapTemplate] Propagating to future entries');

    const { error: propagateError } = await supabase
      .from('roadmap_entries')
      .update({
        title: template.title,
        start_time: template.start_time,
        end_time: template.end_time,
        updated_at: new Date().toISOString(),
      })
      .eq('template_id', id)
      .eq('user_id', userId)
      .gte('date', today);

    if (propagateError) {
      console.error('[RoadmapTemplate] Error propagating changes:', propagateError);
      // Non-critical, continue
    } else {
      console.log('[RoadmapTemplate] Future entries updated');
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: template,
    }),
  };
}

/**
 * Delete a template
 */
async function deleteTemplate(supabase: any, userId: string, params: any) {
  const templateId = params?.id;

  console.log('[RoadmapTemplate] Delete:', templateId);

  if (!templateId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing template id' }),
    };
  }

  // Delete template
  const { error: deleteError } = await supabase
    .from('roadmap_templates')
    .delete()
    .eq('id', templateId)
    .eq('user_id', userId);

  if (deleteError) {
    console.error('[RoadmapTemplate] Error deleting template:', deleteError);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to delete template' }),
    };
  }

  console.log('[RoadmapTemplate] Template deleted successfully');

  // Note: Existing entries from this template are not deleted
  // They remain as manual entries (origin='template' but template_id will be null due to FK cascade)

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Template deleted successfully',
    }),
  };
}
