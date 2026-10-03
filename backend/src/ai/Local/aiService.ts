import axios from 'axios';
import { supabase } from '../../core/config/supabase';

interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface AIResponse {
    response: string;
    intent?: string;
    suggestedActions?: Array<{
        type: 'show_product' | 'create_quote' | 'check_stock' | 'escalate';
        payload?: any;
    }>;
    products?: Array<{ id: string; name: string; sku: string }>;
}

class AIService {
    private vllmEndpoint: string;
    private modelName: string;
    private isWarmingUp: boolean = false;

    constructor() {
        this.vllmEndpoint = process.env.VLLM_ENDPOINT || 'http://host.docker.internal:8000';
        this.modelName = process.env.VLLM_MODEL || '/home/user/local-ai/models/Qwen2.5-Coder-14B-Instruct-AWQ';
        this.warmupModel();
    }

    private async warmupModel() {
        if (this.isWarmingUp) return;
        this.isWarmingUp = true;
        try {
            console.log('[AI Service] 🔄 Warming up model...');
            await axios.post(
                `${this.vllmEndpoint}/v1/chat/completions`,
                { model: this.modelName, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5 },
                { timeout: 120000 }
            );
            console.log('[AI Service] ✅ Model warmed up successfully');
        } catch (error: any) {
            console.warn('[AI Service] ⚠️ Warmup failed (non-critical):', error.message);
        } finally {
            this.isWarmingUp = false;
        }
    }

    async processMessage(
        organizationId: string,
        contactId: string,
        conversationId: string,
        userMessage: string
    ): Promise<AIResponse> {
        try {
            // 1. Construir contexto completo de negocio
            const context = await this.buildBusinessContext(organizationId, contactId, userMessage);

            // 2. Prompt del sistema adaptado a los 8 tipos de consulta
            const systemPrompt = this.buildSystemPrompt(context, userMessage);

            // 3. Historial reciente
            const history = await this.getConversationHistory(conversationId, 5);

            // 4. Construir mensajes
            const messages: AIMessage[] = [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: userMessage }
            ];

            // 5. Llamar a vLLM
            console.log(`[AI Service] Calling vLLM at ${this.vllmEndpoint}/v1/chat/completions`);

            const response = await axios.post(
                `${this.vllmEndpoint}/v1/chat/completions`,
                {
                    model: this.modelName,
                    messages,
                    temperature: 0.7,
                    max_tokens: 512,
                    top_p: 0.9,
                    frequency_penalty: 0.1,
                    presence_penalty: 0.1
                },
                { timeout: 180000, headers: { 'Content-Type': 'application/json' } }
            );

            const aiResponseText = response.data.choices[0].message.content;
            console.log(`[AI Service] Raw response:`, aiResponseText.substring(0, 200));

            // 6. Parsear respuesta
            let parsedResponse: AIResponse;
            try {
                parsedResponse = JSON.parse(aiResponseText);
            } catch {
                parsedResponse = { response: aiResponseText, intent: 'general' };
            }

            // 7. Guardar historial
            await this.saveConversation(organizationId, contactId, conversationId, userMessage, parsedResponse);

            return parsedResponse;
        } catch (error: any) {
            console.error('[AI Service] Error:', error.message);
            throw new Error(`Error al procesar consulta: ${error.message}`);
        }
    }

    // ================================================================
    // CONSTRUCCIÓN DE CONTEXTO DE NEGOCIO (AMPLIADA)
    // ================================================================
    private async buildBusinessContext(
        organizationId: string,
        contactId: string,
        query: string
    ) {
        const queryLower = (query || '').toLowerCase();

        // 1. Información de la empresa (horarios, ubicación, garantía general)
        let companyInfo: any = null;
        try {
            const { data } = await supabase
                .from('company_info')
                .select('*')
                .eq('organization_id', organizationId)
                .limit(1)
                .single();
            companyInfo = data;
        } catch (e) {
            // Tabla puede no existir aún
        }

        // 2. Productos (con garantía, specs técnicas y cronograma)
        const { data: products } = await supabase
            .from('products')
            .select(`
                id,
                sku,
                name,
                description,
                base_price,
                currency,
                warranty,
                technical_specs,
                project_timeline,
                delivery_time,
                category_id,
                category:categories(name),
                stock:stock(quantity)
            `)
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .limit(30);

        // 3. Pedidos del contacto (para "Estado de pedido")
        let orders: any[] = [];
        try {
            const { data } = await supabase
                .from('orders')
                .select('*')
                .eq('organization_id', organizationId)
                .or(`contact_id.eq.${contactId},contact_phone.cs.${contactId}`)
                .order('created_at', { ascending: false })
                .limit(5);
            orders = data || [];
        } catch (e) {
            // Tabla puede no existir aún
        }

        // 4. Información del contacto
        const { data: contact } = await supabase
            .from('contacts')
            .select('profile_name, phone_number, bot_state, custom_attributes')
            .eq('id', contactId)
            .single();

        // 5. Filtro inteligente: si pregunta por algo específico, priorizar
        const filteredProducts = this.filterRelevantProducts(products || [], queryLower);

        return {
            companyInfo: companyInfo || null,
            products: filteredProducts,
            allProducts: products || [],
            orders: orders || [],
            contact: contact || {}
        };
    }

    // ================================================================
    // FILTRADO INTELIGENTE DE PRODUCTOS
    // ================================================================
    private filterRelevantProducts(products: any[], query: string): any[] {
        // Si la consulta menciona algo específico, priorizar
        const keywords: Record<string, string[]> = {
            'cemento': ['MAT-001'],
            'fierro': ['MAT-002'], 'acero': ['MAT-002'], 'varilla': ['MAT-002'], 'hierro': ['MAT-002'],
            'ladrillo': ['MAT-003'],
            'arena': ['MAT-004'],
            'porcelanato': ['ACA-001'], 'piso': ['ACA-001'],
            'grifer': ['ACA-002'], 'lavatorio': ['ACA-002'],
            'puerta': ['ACA-003'],
            'surco': ['PROY-001'], 'jardines': ['PROY-001'],
            'chorrillos': ['PROY-002'], 'mar': ['PROY-002'], 'vista': ['PROY-002'],
            'pachacamac': ['PROY-003'], 'campestre': ['PROY-003'], 'casa': ['PROY-003'],
            'remodel': ['SERV-002'],
            'ampliacion': ['SERV-003'], 'ampliaci': ['SERV-003'],
            'diseño': ['SERV-004'], 'arquitectonico': ['SERV-004'], 'arquitect': ['SERV-004'],
            'suelo': ['SERV-005'], 'calicata': ['SERV-005'],
            'obra nueva': ['SERV-001'], 'construcci': ['SERV-001']
        };

        for (const [key, skus] of Object.entries(keywords)) {
            if (query.includes(key)) {
                const filtered = products.filter(p => skus.includes(p.sku));
                if (filtered.length > 0) return filtered;
            }
        }
        return products;
    }

    // ================================================================
    // PROMPT DEL SISTEMA (AMPLIADO PARA LOS 8 TIPOS DE CONSULTA)
    // ================================================================
    private buildSystemPrompt(context: any, userMessage: string): string {
        const c = context;
        const query = (userMessage || '').toLowerCase();

        // ===== INFORMACIÓN DE LA EMPRESA =====
        const companyBlock = c.companyInfo ? `
### DATOS DE LA EMPRESA:
- Nombre: ${c.companyInfo.company_name}
- Dirección: ${c.companyInfo.address}, ${c.companyInfo.district}, ${c.companyInfo.city}
- Teléfono: ${c.companyInfo.phone}
- WhatsApp: ${c.companyInfo.whatsapp}
- Email: ${c.companyInfo.email}
- Web: ${c.companyInfo.website}

### HORARIO DE ATENCIÓN (OFICIAL):
- Lunes a Viernes: 8:00 AM a 5:00 PM (17:00)
- Sábados: 8:00 AM a 2:00 PM (14:00)
- Domingos: 8:00 AM a 2:00 PM (14:00)

### POLÍTICA DE GARANTÍA GENERAL:
${c.companyInfo.general_warranty}

### MEDIOS DE PAGO:
${c.companyInfo.payment_methods}

### DESPACHO Y ENTREGAS:
${c.companyInfo.delivery_info}
` : '';

        // ===== PRODUCTOS (con specs, garantía y cronograma) =====
        const productsBlock = c.products.map((p: any) => {
            const stock = p.stock?.[0]?.quantity ?? 0;
            const category = p.category?.name || '';
            
            let line = `\n### ${p.name} (${p.sku}) — Categoría: ${category}\n`;
            line += `- Precio: ${p.base_price} ${p.currency}\n`;
            line += `- Stock disponible: ${stock} unidades\n`;
            if (p.description) line += `- Descripción: ${p.description}\n`;
            if (p.warranty) line += `- Garantía: ${p.warranty}\n`;
            if (p.delivery_time) line += `- Tiempo de entrega: ${p.delivery_time}\n`;
            if (p.technical_specs) {
                try {
                    const specs = typeof p.technical_specs === 'string' 
                        ? JSON.parse(p.technical_specs) 
                        : p.technical_specs;
                    line += `- Especificaciones técnicas: ${JSON.stringify(specs)}\n`;
                } catch {}
            }
            if (p.project_timeline) {
                try {
                    const timeline = typeof p.project_timeline === 'string'
                        ? JSON.parse(p.project_timeline)
                        : p.project_timeline;
                    line += `- Cronograma:\n`;
                    line += `  • Inicio: ${timeline.inicio}\n`;
                    line += `  • Entrega: ${timeline.entrega}\n`;
                    line += `  • Avance actual: ${timeline.avance_actual}\n`;
                    if (timeline.hitos) {
                        line += `  • Hitos:\n`;
                        timeline.hitos.forEach((h: any) => {
                            line += `    - ${h.nombre} (${h.fecha}): ${h.estado}\n`;
                        });
                    }
                } catch {}
            }
            return line;
        }).join('\n');

        // ===== PEDIDOS DEL CLIENTE =====
        const ordersBlock = c.orders.length > 0 ? `
### PEDIDOS DEL CLIENTE:
${c.orders.map((o: any) => {
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    const itemsText = (items || []).map((it: any) => `${it.qty}x ${it.name} (SKU ${it.sku})`).join(', ');
    return `- ${o.order_code} | Estado: ${o.status} | Total: ${o.total_amount} ${o.currency} | Items: ${itemsText} | Entrega estimada: ${o.estimated_delivery || 'por confirmar'}${o.notes ? ' | Notas: ' + o.notes : ''}`;
}).join('\n')}
` : '';

        // ===== DETECCIÓN DEL TIPO DE CONSULTA =====
        const queryType = this.detectQueryType(query);

        return `Eres un asistente virtual profesional de ${c.companyInfo?.company_name || 'KREA & TERRA HUB SAC'}, una empresa peruana del rubro de construcción e inmobiliaria con sede en Lima.

Tu objetivo es responder consultas de clientes sobre:
- Proyectos inmobiliarios y cronogramas
- Horarios de atención y ubicación de la empresa
- Especificaciones técnicas de productos
- Precios de materiales y acabados (en SOLES - PEN)
- Cotización de servicios de construcción
- Garantías de productos y servicios
- Estado de pedidos activos del cliente
- Información general de la empresa

${companyBlock}

### PRODUCTOS Y SERVICIOS DISPONIBLES:
${productsBlock || 'No hay productos cargados en este momento.'}

${ordersBlock}

### CLIENTE ACTUAL:
- Nombre: ${c.contact.profile_name || 'Cliente'}
- Teléfono: ${c.contact.phone_number || 'No disponible'}

## TIPO DE CONSULTA DETECTADO: ${queryType}

## REGLAS DE RESPUESTA (OBLIGATORIAS):
1. Responde SIEMPRE en español peruano, tono amable, profesional y cercano.
2. **SOLO** usa información del contexto proporcionado. NUNCA inventes precios, stock, fechas ni especificaciones.
3. Cita precios en el formato original (ej. "450000 PEN", "3500 PEN/m²", "28.50 PEN/bolsa"). No conviertas monedas.
4. Si el cliente pregunta por **estado de pedido**, usa la sección "PEDIDOS DEL CLIENTE" y describe el estado en lenguaje natural.
5. Si preguntan por **cronograma de proyecto**, lista los hitos y el avance actual del proyecto específico.
6. Si preguntan por **especificaciones técnicas**, enumera las características relevantes de forma clara.
7. Si preguntan por **garantía**, cita el tiempo y alcance exacto del producto/servicio + la política general.
8. Si preguntan por **horario de atención**, responde: "Atendemos de lunes a viernes de 8:00 AM a 5:00 PM, y los sábados y domingos de 8:00 AM a 2:00 PM."
9. Si preguntan por **ubicación**, responde con la dirección exacta: "Av. Guardia Civil Norte 702, Urb. Los Parrales de Surco, Santiago de Surco, Lima."
10. Si NO tienes la información necesaria para responder con exactitud, di: "Para darte la información más precisa sobre [tema], te sugiero contactar a uno de nuestros asesores al WhatsApp ${c.companyInfo?.whatsapp || '+51 972 494 910'}."
11. Respuestas concisas: máximo 150 palabras. Usa listas con viñetas cuando enumeres productos o hitos.
12. Si el cliente pregunta algo fuera del rubro (política, deportes, etc.), redirige amablemente hacia lo que sí puedes ayudar.
13. No uses formato JSON en tu respuesta. Responde en texto natural como una conversación por WhatsApp.
14. Si el cliente quiere cotizar, confirma los productos y cantidades antes de dar el total.

## RESPUESTA:
Responde al mensaje del cliente de forma natural, concisa y útil.`;
    }

    // ================================================================
    // DETECCIÓN DEL TIPO DE CONSULTA (para adaptar el tono)
    // ================================================================
    private detectQueryType(query: string): string {
        if (/horario|hora.*atenci|abren|cierran|atienden|trabajan/.test(query)) return 'HORARIO DE ATENCIÓN';
        if (/ubicaci|direcci|d[óo]nde.*est[aá]|local|oficina|llegar/.test(query)) return 'UBICACIÓN DE TIENDA';
        if (/estado.*pedido|pedido.*estado|seguimiento|rastrear.*pedido|ped-|número de pedido/.test(query)) return 'ESTADO DE PEDIDO';
        if (/cronograma|avance.*obra|entrega|plazo|fecha.*entrega|hito/.test(query)) return 'CRONOGRAMA DE PROYECTO';
        if (/especificac|ficha.*t[cé]cnica|caracter[ií]sticas|dimensiones|medidas|norma/.test(query)) return 'ESPECIFICACIONES TÉCNICAS';
        if (/garant[ií]a|devoluc|post.?venta|reclamo.*producto/.test(query)) return 'DETALLES DE GARANTÍA';
        if (/precio|cuesta|cu[aá]nto|costo|tarifa|valor|vale/.test(query)) return 'PRECIOS DE MATERIALES';
        if (/cotizaci|cotizar|presupuesto|servicio|obra nueva|remodelaci|ampliaci/.test(query)) return 'COTIZACIÓN DE SERVICIOS';
        return 'CONSULTA GENERAL';
    }

    private async getConversationHistory(conversationId: string, limit: number = 5): Promise<AIMessage[]> {
        const { data } = await supabase
            .from('messages')
            .select('direction, content')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (!data || data.length === 0) return [];

        return data.reverse().map(msg => {
            // Parsear JSON de Baileys si viene en inbound
            let content = msg.content;
            if (msg.direction === 'inbound') {
                try {
                    const parsed = JSON.parse(content);
                    content = parsed?.message?.conversation
                        || parsed?.message?.extendedTextMessage?.text
                        || parsed?.text?.body
                        || parsed?.body
                        || content;
                } catch {}
            }
            return {
                role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
                content
            };
        });
    }

    private async saveConversation(
        organizationId: string,
        contactId: string,
        conversationId: string,
        userMessage: string,
        aiResponse: AIResponse
    ) {
        try {
            await supabase.from('ai_conversations').insert({
                organization_id: organizationId,
                contact_id: contactId,
                conversation_id: conversationId,
                user_message: userMessage,
                ai_response: aiResponse.response,
                intent: aiResponse.intent || 'general',
                context: aiResponse
            });
        } catch (error) {
            console.warn('[AI Service] Could not save to ai_conversations table:', error);
        }
    }
}

export const aiService = new AIService();