const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tqjpbnplnpujygojgkcy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxanBibnBsbnB1anlnb2pna2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjAyMjIsImV4cCI6MjA4NzUzNjIyMn0.i6iEk7KqBsct7UG9ADemu9x3DeyEWulof2ugy4xR6JE';
const supabase = createClient(supabaseUrl, supabaseKey);

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
