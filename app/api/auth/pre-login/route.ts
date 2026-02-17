import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { compare } from "bcryptjs";
import { generateOTPCode, sendSMS, createOTPMessage, maskPhoneNumber } from "../../../../lib/smsapi";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email i hasło są wymagane" }, { status: 400 });
    }

    const user = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Nieprawidłowe dane logowania" }, { status: 401 });
    }

    const isValid = await compare(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json({ error: "Nieprawidłowe dane logowania" }, { status: 401 });
    }

    // Sprawdź czy użytkownik ma numer telefonu
    if (!user.phoneNumber) {
      // Jeśli brak numeru, pozwól na logowanie bez 2FA (lub zablokuj, zależnie od polityki)
      // W tym przypadku zwracamy informację, że 2FA nie jest wymagane
      return NextResponse.json({ 
        requires2FA: false,
        message: "2FA nie jest skonfigurowane dla tego konta" 
      });
    }

    // Generuj i wyślij kod OTP
    const code = generateOTPCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minut

    // Zapisz kod w bazie
    await prisma.otpVerification.create({
      data: {
        phoneNumber: user.phoneNumber,
        code,
        expiresAt,
        verified: false,
      },
    });

    // Wyślij SMS
    const message = createOTPMessage(code);
    const smsResult = await sendSMS(user.phoneNumber, message);

    if (!smsResult.success) {
      console.error("Błąd wysyłania SMS:", smsResult.error);
      return NextResponse.json({ error: "Błąd wysyłania kodu SMS" }, { status: 500 });
    }

    return NextResponse.json({
      requires2FA: true,
      maskedPhone: maskPhoneNumber(user.phoneNumber),
    });

  } catch (error) {
    console.error("Błąd pre-login:", error);
    return NextResponse.json({ error: "Wystąpił błąd serwera" }, { status: 500 });
  }
}
