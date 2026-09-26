import { NextRequest, NextResponse } from 'next/server';
import mockData from '@/data/mock_db.json';

export async function POST(req: NextRequest) {
  try {
    const { message, language } = await req.json();
    const isKz = language === 'kz';

    const sampleDoctors = mockData.doctors.slice(0, 3).map((d: any) => ({
      id: d.id,
      name: `${d.first_name} ${d.last_name}`,
      specialty: d.specialty,
      clinic_id: d.clinic_id,
      rating: d.rating,
      price: d.consultation_price || 10000,
      photo: d.photo_url,
    }));

    const reply = isKz
      ? `Сіздің "${message}" бойынша сұранысыңызға байланысты ең үздік клиникалар мен білікті мамандар табылды. Төмендегі ұсыныстарды көре аласыз немесе іздеу жолағынан нақты бағаларды салыстыра аласыз.`
      : `По вашему запросу "${message}" мы подобрали проверенные медицинские центры и квалифицированных специалистов. Вы можете ознакомиться со списком врачей ниже или воспользоваться поиском для сравнения цен.`;

    return NextResponse.json({
      reply,
      recommended_doctors: sampleDoctors,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err?.message || 'Chat error' }, { status: 400 });
  }
}
