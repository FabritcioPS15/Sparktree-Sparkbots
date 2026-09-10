const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: msg } = await supabase
    .from('messages')
    .select('id, conversation_id, direction, status')
    .eq('direction', 'inbound')
    .limit(1)
    .maybeSingle();
  if (!msg) { console.log('NO_INBOUND_MSG'); process.exit(0); }
  console.log('before:', msg.status, msg.conversation_id);
  await supabase.from('messages').update({ status: 'sent' }).eq('id', msg.id);
  console.log('set_to_sent');
})().catch((e) => { console.error(e); process.exit(1); });