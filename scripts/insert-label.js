import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.VITE_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        "Configuração do Supabase ausente. Defina SUPABASE_URL/SUPABASE_ANON_KEY ou VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY."
    );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function insertData() {
    const internalSerial = `INT-LABEL-${Math.floor(Math.random() * 1000000)}`;

    console.log(`Inserindo dado com ID Interno: ${internalSerial}`);

    const { data, error } = await supabase.from('products').insert([
        {
            brand: 'Electrolux',
            model: 'IM8S',
            original_serial: '30926473',
            internal_serial: internalSerial,
            voltage: '127V',
            status: 'CADASTRO',
            technical_data: {
                commercial_code: '02623FBA',
                color: '30',
                type: 'COMB. FROST FREE ELUX',
                pnc_ml: '900277738 / 00',
                manufacturing_date: '03/03/2023 09:50:18',
                gas_frigor: 'R600a',
                gas_charge: '45 g',
                compressor: 'EMBRACO',
                vol_freezer: '200 L',
                vol_refrig: '390 L',
                vol_total: '590 L',
                pressure_kpa: '788 / 52',
                pressure_psig: '100 / -7.09',
                freezing_cap: '9 kg/24h',
                current: '2.3 A',
                defrost_power: '316 W',
                frequency: '60 Hz'
            }
        }
    ]);

    if (error) {
        console.error('Erro ao inserir:', error);
    } else {
        console.log('Sucesso! Produto inserido.');
    }
}

insertData();
