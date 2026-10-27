import { jsPDF } from 'jspdf';
import { Certificate } from '../types';

export function downloadCertificatePdf(certificate: Certificate): void {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const clubName = certificate.clubName || 'eCricketCoach';

  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, width, height, 'F');
  pdf.setDrawColor(180, 130, 45);
  pdf.setLineWidth(1.4);
  pdf.rect(9, 9, width - 18, height - 18);
  pdf.setLineWidth(0.35);
  pdf.rect(13, 13, width - 26, height - 26);

  pdf.setTextColor(35, 54, 71);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  const clubNameWidth = Math.min(pdf.getTextWidth(clubName), width - 100);

  if (certificate.clubLogo) {
    const imageType = certificate.clubLogo.startsWith('data:image/png;') ? 'PNG'
      : certificate.clubLogo.startsWith('data:image/jpeg;') ? 'JPEG'
        : undefined;
    if (!imageType) throw new Error('The saved club logo is not a supported PNG or JPEG image.');
    const image = pdf.getImageProperties(certificate.clubLogo);
    const logoSize = 18;
    const gap = 4;
    const scale = Math.min(logoSize / image.width, logoSize / image.height);
    const groupWidth = logoSize + gap + clubNameWidth;
    const groupLeft = (width - groupWidth) / 2;
    pdf.addImage(certificate.clubLogo, imageType, groupLeft, 18, image.width * scale, image.height * scale, undefined, 'FAST');
    pdf.text(clubName, groupLeft + logoSize + gap, 29, { maxWidth: width - groupLeft - logoSize - gap - 20 });
  } else {
    pdf.text(clubName, width / 2, 27, { align: 'center', maxWidth: width - 40 });
  }

  pdf.setFontSize(10);
  pdf.setTextColor(138, 100, 35);
  pdf.text('CERTIFICATE OF ACHIEVEMENT', width / 2, 48, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.setTextColor(75, 85, 99);
  pdf.text('This certificate is proudly presented to', width / 2, 67, { align: 'center' });
  pdf.setFont('times', 'bold');
  pdf.setFontSize(30);
  pdf.setTextColor(20, 43, 60);
  pdf.text(certificate.playerName, width / 2, 87, { align: 'center', maxWidth: width - 55 });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.setTextColor(75, 85, 99);
  pdf.text('for achieving', width / 2, 104, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(25, 125, 93);
  pdf.text(certificate.achievedLevel, width / 2, 117, { align: 'center' });
  pdf.setFontSize(12);
  pdf.setTextColor(55, 65, 81);
  pdf.text(certificate.discipline, width / 2, 126, { align: 'center' });

  pdf.setDrawColor(203, 213, 225);
  pdf.line(34, 135, width - 34, 135);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(55, 65, 81);
  const note = certificate.coachNotes || '';
  const commendation = certificate.aiCommendation || '';
  if (note) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Coach notes', 35, 145);
    pdf.setFont('helvetica', 'normal');
    pdf.text(pdf.splitTextToSize(note, 105), 35, 151);
  }
  if (commendation) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Achievement commendation', width - 140, 145);
    pdf.setFont('helvetica', 'normal');
    pdf.text(pdf.splitTextToSize(commendation, 105), width - 140, 151);
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(certificate.coachName, width / 2, 177, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('Coach', width / 2, 182, { align: 'center' });
  pdf.text(`Issued ${certificate.issuedDate}`, 24, height - 20);
  pdf.text(`Certificate No. ${certificate.certificateNumber}`, width - 24, height - 20, { align: 'right' });

  const filename = `${certificate.playerName}-${certificate.achievedLevel}-certificate`
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  pdf.save(`${filename}.pdf`);
}
