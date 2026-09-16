/**
 * Shared authentication layout for Login and Register.
 *
 * UI ONLY:
 * - Does not change authentication logic.
 * - Keeps the existing title, subtitle, children and footer props.
 */

import styled from 'styled-components';

const Screen = styled.div`
  min-height: 100vh;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  position: relative;

  display: flex;
  align-items: center;

  background:
    radial-gradient(
      circle at 90% 10%,
      rgba(139, 92, 246, 0.14),
      transparent 30%
    ),
    radial-gradient(
      circle at 10% 90%,
      rgba(124, 92, 246, 0.12),
      transparent 30%
    ),
    linear-gradient(
      135deg,
      #faf9ff 0%,
      #f5f3ff 45%,
      #f9f8ff 100%
    );

  padding: 48px 60px;

  @media (max-width: 1100px) {
    padding: 40px 32px;
  }

  @media (max-width: 800px) {
    padding: 30px 20px;
    align-items: flex-start;
  }
`;

/* Decorative background circles */

const GlowOne = styled.div`
  position: absolute;
  width: 380px;
  height: 380px;
  border-radius: 50%;
  background: rgba(124, 92, 246, 0.07);
  top: -180px;
  right: -100px;
  pointer-events: none;
`;

const GlowTwo = styled.div`
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  background: rgba(124, 92, 246, 0.06);
  bottom: -180px;
  left: -100px;
  pointer-events: none;
`;

/* Main content */

const Container = styled.div`
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;

  display: grid;
  grid-template-columns: minmax(0, 1fr) 520px;
  gap: 90px;
  align-items: center;

  position: relative;
  z-index: 2;

  @media (max-width: 1200px) {
    grid-template-columns: minmax(0, 1fr) 460px;
    gap: 50px;
  }

  @media (max-width: 950px) {
    grid-template-columns: 1fr;
    max-width: 600px;
    gap: 40px;
  }
`;

/* =========================================================
   BRAND
   ========================================================= */

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 72px;

  @media (max-width: 950px) {
    margin-bottom: 40px;
  }
`;

const LogoMark = styled.div`
  width: 52px;
  height: 52px;
  flex-shrink: 0;

  border-radius: 15px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: linear-gradient(
    135deg,
    #7355f5,
    #8b5cf6
  );

  box-shadow:
    0 12px 25px rgba(124, 92, 246, 0.25),
    inset 0 1px 1px rgba(255, 255, 255, 0.4);
`;

const LogoSvg = styled.svg`
  width: 30px;
  height: 30px;
`;

const BrandText = styled.div`
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.8px;
  color: #172554;

  span {
    background: linear-gradient(
      90deg,
      #6746f5,
      #8b5cf6
    );

    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
`;

/* =========================================================
   LEFT SECTION
   ========================================================= */

const LeftSection = styled.section`
  min-width: 0;
`;

const Badge = styled.div`
  width: fit-content;

  display: inline-flex;
  align-items: center;
  gap: 8px;

  padding: 8px 14px;

  border-radius: 999px;

  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(124, 92, 246, 0.16);

  color: #7052ee;

  font-size: 12px;
  font-weight: 700;

  box-shadow: 0 5px 18px rgba(124, 92, 246, 0.07);

  margin-bottom: 26px;
`;

const BadgeDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;

  background: #7654f6;

  box-shadow: 0 0 0 4px rgba(118, 84, 246, 0.12);
`;

const HeroTitle = styled.h1`
  margin: 0;

  max-width: 650px;

  font-size: clamp(48px, 5vw, 72px);
  line-height: 0.98;

  letter-spacing: -3.5px;

  font-weight: 800;

  color: #17163a;

  span {
    display: block;

    background: linear-gradient(
      90deg,
      #704cf5 0%,
      #8b5cf6 50%,
      #9a72ff 100%
    );

    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  @media (max-width: 950px) {
    font-size: 54px;
  }

  @media (max-width: 600px) {
    font-size: 42px;
    letter-spacing: -2px;
  }
`;

const Description = styled.p`
  max-width: 580px;

  margin: 28px 0 30px;

  font-size: 16px;
  line-height: 1.7;

  color: #65709b;

  @media (max-width: 600px) {
    font-size: 14px;
  }
`;

/* =========================================================
   FEATURES
   ========================================================= */

const Features = styled.div`
  display: flex;
  flex-direction: column;
  gap: 13px;
`;

const Feature = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;

  color: #334276;

  font-size: 14px;
  font-weight: 600;
`;

const FeatureIcon = styled.div`
  width: 32px;
  height: 32px;

  flex-shrink: 0;

  border-radius: 10px;

  display: flex;
  align-items: center;
  justify-content: center;

  color: #7654f6;

  background: linear-gradient(
    135deg,
    #eee9ff,
    #e5ddff
  );

  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.8);
`;

const Icon = styled.span`
  font-size: 16px;
  line-height: 1;
`;

/* =========================================================
   DOCUMENT ILLUSTRATION
   ========================================================= */

const Illustration = styled.div`
  width: 500px;
  height: 210px;

  position: relative;

  margin-top: 28px;

  @media (max-width: 600px) {
    width: 100%;
    height: 180px;
  }
`;

const Document = styled.div`
  position: absolute;

  width: 230px;
  height: 135px;

  border-radius: 18px;

  background: rgba(255, 255, 255, 0.9);

  border: 1px solid rgba(124, 92, 246, 0.12);

  box-shadow:
    0 25px 45px rgba(90, 67, 180, 0.12),
    0 5px 15px rgba(90, 67, 180, 0.05);

  padding: 18px;

  box-sizing: border-box;
`;

const BackDocument = styled(Document)`
  left: 10px;
  bottom: 15px;

  transform: rotate(-8deg);

  opacity: 0.9;
`;

const MiddleDocument = styled(Document)`
  left: 135px;
  bottom: 30px;

  transform: rotate(3deg);

  z-index: 2;
`;

const FrontDocument = styled(Document)`
  left: 255px;
  bottom: 8px;

  transform: rotate(-3deg);

  z-index: 3;

  @media (max-width: 600px) {
    left: 50%;
    transform: translateX(-35%) rotate(-3deg);
  }
`;

const PdfBadge = styled.div`
  width: 32px;
  height: 32px;

  border-radius: 8px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: #eee9ff;

  color: #7654f6;

  font-size: 10px;
  font-weight: 800;

  margin-bottom: 10px;
`;

const DocumentLine = styled.div`
  width: ${({ $width }) => $width || '80%'};
  height: 7px;

  border-radius: 20px;

  background: #e8e5f4;

  margin-bottom: 8px;
`;

const Sparkle = styled.div`
  position: absolute;

  right: 55px;
  top: 12px;

  width: 45px;
  height: 45px;

  border-radius: 13px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: linear-gradient(
    135deg,
    #7754f6,
    #956eff
  );

  color: white;

  font-size: 23px;

  box-shadow:
    0 15px 30px rgba(118, 84, 246, 0.28);

  z-index: 5;
`;

/* =========================================================
   RIGHT AUTH CARD
   ========================================================= */

const RightSection = styled.section`
  width: 100%;

  display: flex;
  justify-content: center;
`;

const AuthWrapper = styled.div`
  width: 100%;
`;

const PanelCard = styled.div`
  width: 100%;
  box-sizing: border-box;

  background: rgba(255, 255, 255, 0.94);

  border: 1px solid rgba(124, 92, 246, 0.08);

  border-radius: 24px;

  padding: 34px 38px 30px;

  box-shadow:
    0 30px 70px rgba(48, 38, 110, 0.12),
    0 8px 25px rgba(48, 38, 110, 0.06);

  backdrop-filter: blur(20px);

  @media (max-width: 600px) {
    padding: 28px 22px 25px;
    border-radius: 20px;
  }
`;

/* Card logo */

const CardBrand = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  margin-bottom: 20px;
`;

const CardLogo = styled.div`
  width: 58px;
  height: 58px;

  border-radius: 17px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: linear-gradient(
    135deg,
    #7355f5,
    #906cff
  );

  box-shadow:
    0 12px 25px rgba(124, 92, 246, 0.22);
`;

const CardLogoText = styled.div`
  margin-top: 10px;

  font-size: 25px;
  font-weight: 800;

  letter-spacing: -1px;

  color: #172554;

  span {
    background: linear-gradient(
      90deg,
      #6746f5,
      #8b5cf6
    );

    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
`;

const CardTitle = styled.h2`
  margin: 12px 0 5px;

  text-align: center;

  font-size: 27px;
  line-height: 1.2;

  letter-spacing: -1px;

  font-weight: 800;

  color: #18204a;
`;

const CardSubtitle = styled.p`
  margin: 0 auto 28px;

  text-align: center;

  font-size: 13px;
  line-height: 1.6;

  color: #7b84a7;

  max-width: 350px;
`;

/* =========================================================
   EXISTING FORM STYLING
   ========================================================= */

const FormStyles = styled.div`
  label {
    display: block;

    margin-bottom: 8px;

    color: #263157;

    font-size: 13px;
    font-weight: 700;
  }

  input {
    width: 100%;
    box-sizing: border-box;

    height: 48px;

    padding: 0 15px;

    border-radius: 12px;

    border: 1px solid #dce1f4;

    background: #fbfbff;

    color: #283158;

    font-size: 13px;

    outline: none;

    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      background 0.2s ease;

    &::placeholder {
      color: #a6aec9;
    }

    &:hover {
      border-color: #c9cdef;
    }

    &:focus {
      border-color: #8165f7;

      background: #ffffff;

      box-shadow:
        0 0 0 4px rgba(129, 101, 247, 0.1);
    }

    &:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
  }

  button[type='submit'] {
    width: 100%;

    min-height: 48px;

    margin-top: 6px;

    border: none;

    border-radius: 12px;

    background: linear-gradient(
      90deg,
      #6948ef,
      #8c63f7
    );

    color: white;

    font-size: 14px;
    font-weight: 700;

    cursor: pointer;

    box-shadow:
      0 10px 22px rgba(112, 76, 239, 0.25);

    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease,
      opacity 0.18s ease;

    &:hover:not(:disabled) {
      transform: translateY(-1px);

      box-shadow:
        0 14px 28px rgba(112, 76, 239, 0.32);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }
`;

/* =========================================================
   FOOTER
   ========================================================= */

const Footer = styled.p`
  margin: 18px 0 0;

  text-align: center;

  color: #7c84a4;

  font-size: 13px;

  a {
    color: #6746f5;

    font-weight: 700;

    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

/* =========================================================
   LOGO COMPONENT
   ========================================================= */

function QueryNestLogo() {
  return (
    <LogoMark>
      <LogoSvg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M7 25C9 30 14 33 20 33C27 33 33 29 35 23"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d="M9 20C11 25 15 28 21 28C27 28 32 25 34 20"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d="M12 16C13 11 17 8 21 8C25 8 28 11 28 15"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <circle
          cx="28"
          cy="14"
          r="3"
          fill="white"
        />

        <path
          d="M15 17C16 20 18 22 21 22C24 22 27 20 28 17"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </LogoSvg>
    </LogoMark>
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <Screen>
      <GlowOne />
      <GlowTwo />

      <Container>

        {/* ================= LEFT ================= */}

        <LeftSection>

          <Brand>
            <QueryNestLogo />

            <BrandText>
              Query<span>Nest</span>
            </BrandText>
          </Brand>

          <Badge>
            <BadgeDot />
            Intelligent document workspace
          </Badge>

          <HeroTitle>
            Your documents.
            <span>Your answers.</span>
          </HeroTitle>

          <Description>
            Upload your documents, ask questions in
            natural language, and get clear answers
            grounded in your own files.
          </Description>

          <Features>

            <Feature>
              <FeatureIcon>
                <Icon>✦</Icon>
              </FeatureIcon>

              Ask questions about your documents
            </Feature>

            <Feature>
              <FeatureIcon>
                <Icon>✓</Icon>
              </FeatureIcon>

              Get answers backed by document citations
            </Feature>

            <Feature>
              <FeatureIcon>
                <Icon>⌕</Icon>
              </FeatureIcon>

              Find important information faster
            </Feature>

          </Features>

          <Illustration>

            <BackDocument>
              <PdfBadge>PDF</PdfBadge>
              <DocumentLine $width="70%" />
              <DocumentLine $width="90%" />
              <DocumentLine $width="60%" />
            </BackDocument>

            <MiddleDocument>
              <PdfBadge>PDF</PdfBadge>
              <DocumentLine $width="80%" />
              <DocumentLine $width="60%" />
              <DocumentLine $width="75%" />
            </MiddleDocument>

            <FrontDocument>
              <PdfBadge>PDF</PdfBadge>
              <DocumentLine $width="75%" />
              <DocumentLine $width="90%" />
              <DocumentLine $width="55%" />
            </FrontDocument>

            <Sparkle>✦</Sparkle>

          </Illustration>

        </LeftSection>

        {/* ================= RIGHT ================= */}

        <RightSection>

          <AuthWrapper>

            <PanelCard>

              <CardBrand>

                <CardLogo>
                  <LogoSvg
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M7 25C9 30 14 33 20 33C27 33 33 29 35 23"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    <path
                      d="M9 20C11 25 15 28 21 28C27 28 32 25 34 20"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    <path
                      d="M12 16C13 11 17 8 21 8C25 8 28 11 28 15"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    <circle
                      cx="28"
                      cy="14"
                      r="3"
                      fill="white"
                    />

                    <path
                      d="M15 17C16 20 18 22 21 22C24 22 27 20 28 17"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </LogoSvg>
                </CardLogo>

                <CardLogoText>
                  Query<span>Nest</span>
                </CardLogoText>

              </CardBrand>

              <CardTitle>
                {title}
              </CardTitle>

              <CardSubtitle>
                {subtitle}
              </CardSubtitle>

              <FormStyles>
                {children}
              </FormStyles>

            </PanelCard>

            {footer && (
              <Footer>
                {footer}
              </Footer>
            )}

          </AuthWrapper>

        </RightSection>

      </Container>

    </Screen>
  );
}