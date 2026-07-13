import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json({ status: "error", message: "Query de busca vazia." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ status: "error", message: "Chave da API do Google Maps (GOOGLE_MAPS_API_KEY) não configurada no arquivo .env.local" }, { status: 500 });
    }

    // Usando a nova API do Google Places (Text Search)
    const googleResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Pedimos apenas os campos necessários para economizar faturamento
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.rating,places.photos"
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "pt-BR"
      })
    });

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error("Erro do Google Maps API:", errorText);
      return NextResponse.json({ status: "error", message: "Falha ao buscar no Google Maps. Verifique o faturamento da API." }, { status: 500 });
    }

    const data = await googleResponse.json();
    const places = data.places || [];

    // Mapear os resultados para o formato que o nosso sistema de empresas espera
    const results = places.map(place => {
      // Formata as fotos se existirem (Pega a primeira foto em alta resolução)
      const fotos = [];
      if (place.photos && place.photos.length > 0) {
        // Construir URL da foto do Google Places
        const fotoRef = place.photos[0].name;
        fotos.push(`https://places.googleapis.com/v1/${fotoRef}/media?maxHeightPx=800&maxWidthPx=800&key=${apiKey}`);
      }

      // Extrair Bairro do endereço (tentativa simples)
      let bairro = "Centro";
      if (place.formattedAddress) {
        const partes = place.formattedAddress.split(",");
        if (partes.length > 1) {
          // Geralmente o bairro fica na penúltima parte antes da cidade, ou na segunda
          bairro = partes[1].trim().split("-")[0].trim();
        }
      }

      // Limpar o telefone para o padrão do WhatsApp (somente números)
      let whatsappFormatado = "";
      if (place.internationalPhoneNumber) {
        whatsappFormatado = place.internationalPhoneNumber.replace(/\D/g, "");
      }

      return {
        google_place_id: place.id || "",
        place_id: place.id || "",
        nome: place.displayName?.text || "Sem Nome",
        endereco: place.formattedAddress || "",
        bairro: bairro,
        avaliacao: place.rating || 4.5,
        telefone: place.internationalPhoneNumber || "",
        whatsapp: whatsappFormatado, // Usado na importação para validar
        fotos: fotos,
        categoria: "Busca Web", // Pode ser ajustado pelo usuário depois
        descricao: `Empresa encontrada via Google Maps. Endereço: ${place.formattedAddress}`,
        faixa_preco: "Médio",
        horario: "Aberto",
        tags: ["Lead", "Maps", bairro]
      };
    });

    return NextResponse.json({ status: "success", results });
  } catch (erro) {
    console.error("Erro interno na rota de busca do mapa:", erro);
    return NextResponse.json({ status: "error", message: erro.message }, { status: 500 });
  }
}
