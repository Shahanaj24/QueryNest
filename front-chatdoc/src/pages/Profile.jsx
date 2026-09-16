/**
 * Profile page (requirement 5).
 *
 * QueryNest UI enhanced.
 * Existing profile loading, updating, authentication state and API logic
 * are preserved.
 */

import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Label,
  PageSubtitle,
  PageTitle,
  Spinner,
} from '../components/ui';
import { errorMessage, userApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { formatDate } from '../utils/format';

const Scroll = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;

  background:
    radial-gradient(
      circle at 90% 5%,
      rgba(124, 92, 255, 0.12),
      transparent 28%
    ),
    radial-gradient(
      circle at 8% 90%,
      rgba(124, 92, 255, 0.07),
      transparent 25%
    ),
    #f8f7ff;
`;

const Container = styled.div`
  width: min(100%, 920px);
  margin: 0 auto;
  padding: 42px 32px 70px;

  @media (max-width: 700px) {
    padding: 28px 18px 50px;
  }
`;

/* ---------------- BRAND ---------------- */

const BrandRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
`;

const LogoMark = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 12px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: linear-gradient(135deg, #7052f5, #916cff);
  color: #fff;

  font-size: 20px;
  font-weight: 800;

  box-shadow: 0 8px 22px rgba(112, 82, 245, 0.25);
`;

const BrandName = styled.div`
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -0.03em;
  color: #17204a;

  span {
    color: #7656f6;
  }
`;

/* ---------------- PROFILE HERO ---------------- */

const ProfileHero = styled.div`
  position: relative;
  overflow: hidden;

  display: flex;
  align-items: center;
  gap: 20px;

  padding: 25px;
  margin-bottom: 18px;

  border: 1px solid rgba(121, 91, 244, 0.15);
  border-radius: 22px;

  background:
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.96),
      rgba(247, 244, 255, 0.94)
    );

  box-shadow:
    0 18px 45px rgba(47, 38, 103, 0.06),
    0 2px 8px rgba(47, 38, 103, 0.03);

  &::after {
    content: '';
    position: absolute;
    width: 180px;
    height: 180px;
    right: -70px;
    top: -80px;
    border-radius: 50%;
    background: rgba(126, 92, 255, 0.08);
    pointer-events: none;
  }

  @media (max-width: 560px) {
    align-items: flex-start;
    padding: 20px;
  }
`;

const Avatar = styled.div`
  position: relative;
  z-index: 1;

  width: 70px;
  height: 70px;
  flex-shrink: 0;

  border-radius: 20px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: linear-gradient(135deg, #7052f5, #956fff);
  color: #fff;

  font-size: 27px;
  font-weight: 750;

  box-shadow:
    0 12px 28px rgba(112, 82, 245, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
`;

const IdentityText = styled.div`
  position: relative;
  z-index: 1;

  min-width: 0;

  h2 {
    margin: 0 0 5px;
    font-size: 21px;
    font-weight: 720;
    letter-spacing: -0.03em;
    color: #202344;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
    font-size: 13.5px;
    color: #777c9d;
    overflow-wrap: anywhere;
  }
`;

const AccountBadge = styled.div`
  position: relative;
  z-index: 1;

  margin-left: auto;

  padding: 6px 11px;

  border-radius: 999px;

  background: #eeeaff;
  color: #7052ed;

  font-size: 11px;
  font-weight: 650;

  @media (max-width: 560px) {
    display: none;
  }
`;

/* ---------------- STATS ---------------- */

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;

  margin-bottom: 20px;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const Stat = styled(Card)`
  position: relative;
  overflow: hidden;

  padding: 20px;

  border-radius: 17px;

  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e9e6f5;

  box-shadow: 0 6px 22px rgba(47, 38, 103, 0.035);

  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(75, 59, 150, 0.07);
  }

  strong {
    display: block;

    margin-bottom: 5px;

    font-size: 23px;
    font-weight: 720;
    letter-spacing: -0.03em;

    color: #25284c;
  }

  span {
    font-size: 12.5px;
    color: #8589a5;
  }
`;

/* ---------------- FORM ---------------- */

const FormCard = styled(Card)`
  padding: 25px;

  border-radius: 20px;

  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #e9e6f5;

  box-shadow:
    0 15px 35px rgba(47, 38, 103, 0.045),
    0 2px 8px rgba(47, 38, 103, 0.025);

  @media (max-width: 600px) {
    padding: 20px;
  }
`;

const FormHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 21px;
`;

const FormIcon = styled.div`
  width: 40px;
  height: 40px;
  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 12px;

  background: #eeeaff;
  color: #7052ed;

  font-size: 18px;
`;

const FormHeading = styled.div`
  h3 {
    margin: 0 0 3px;

    font-size: 16px;
    font-weight: 700;

    color: #25284c;
  }

  p {
    margin: 0;

    font-size: 12.5px;
    color: #8589a5;
  }
`;

const FormDivider = styled.div`
  height: 1px;
  background: #eeeaf7;
  margin: 0 0 20px;
`;

const ReadOnlyNote = styled.p`
  margin: 6px 0 0;

  font-size: 11.5px;
  line-height: 1.45;

  color: #9699b0;
`;

/* ---------------- PURPLE SAVE BUTTON ---------------- */

const SaveButton = styled(Button)`
  min-width: 135px;

  padding: 10px 18px;

  border-radius: 11px;

  background: linear-gradient(
    135deg,
    #7052f5 0%,
    #8b6cff 100%
  ) !important;

  color: #ffffff !important;

  border: none !important;

  font-weight: 600;

  box-shadow:
    0 8px 18px rgba(112, 82, 245, 0.22);

  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;

  &:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      #6043e8 0%,
      #7959f2 100%
    ) !important;

    transform: translateY(-1px);

    box-shadow:
      0 10px 22px rgba(112, 82, 245, 0.28);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: #dcd9e9 !important;
    color: #9894aa !important;
    box-shadow: none;
    cursor: not-allowed;
  }

  @media (max-width: 500px) {
    width: 100%;
  }
`;

/* ---------------- LOADING ---------------- */

const Centre = styled.div`
  flex: 1;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  min-height: 300px;

  background:
    radial-gradient(
      circle at 50% 30%,
      rgba(124, 92, 255, 0.08),
      transparent 35%
    ),
    #f8f7ff;

  color: ${theme.color.inkFaint};
  font-size: 14px;
`;

/* ---------------- COMPONENT ---------------- */

export default function Profile() {
  const { user, setUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await userApi.profile();

      setProfile(data);
      setName(data.name);
      setError('');
    } catch (err) {
      setError(
        errorMessage(err, 'Could not load your profile.')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmed = name.trim();

    if (!trimmed) {
      setError('Please enter your name.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const updated = await userApi.updateProfile({
        name: trimmed,
      });

      setProfile((current) => ({
        ...current,
        ...updated,
      }));

      setUser((current) => ({
        ...current,
        ...updated,
      }));

      setNotice('Your profile was updated.');
    } catch (err) {
      setError(
        errorMessage(
          err,
          'Could not update your profile.'
        )
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Centre>
        <Spinner $size={16} />
        Loading profile...
      </Centre>
    );
  }

  const displayName =
    profile?.name || user?.name || '';

  const unchanged =
    name.trim() === (profile?.name || '');

  return (
    <Scroll>
      <Container>

        {/* QueryNest branding */}
        <BrandRow>
          <LogoMark aria-hidden="true">
            Q
          </LogoMark>

          <BrandName>
            Query<span>Nest</span>
          </BrandName>
        </BrandRow>

        <PageTitle>
          Profile
        </PageTitle>

        <PageSubtitle>
          Manage your account details and view your
          QueryNest activity.
        </PageSubtitle>

        {error && (
          <Alert role="alert">
            {error}
          </Alert>
        )}

        {notice && !error && (
          <Alert $tone="success">
            {notice}
          </Alert>
        )}

        {/* Profile identity */}
        <ProfileHero>

          <Avatar aria-hidden="true">
            {displayName
              .charAt(0)
              .toUpperCase() || '?'}
          </Avatar>

          <IdentityText>
            <h2>{displayName}</h2>
            <p>{profile?.email}</p>
          </IdentityText>

          <AccountBadge>
            Account
          </AccountBadge>

        </ProfileHero>

        {/* Statistics */}
        <Stats>

          <Stat>
            <strong>
              {profile?.documentCount ?? 0}
            </strong>

            <span>
              Documents
            </span>
          </Stat>

          <Stat>
            <strong>
              {profile?.conversationCount ?? 0}
            </strong>

            <span>
              Conversations
            </span>
          </Stat>

          <Stat>
            <strong>
              {formatDate(profile?.createdAt)}
            </strong>

            <span>
              Member since
            </span>
          </Stat>

        </Stats>

        {/* Edit profile */}
        <FormCard>

          <FormHeader>

            <FormIcon aria-hidden="true">
              ✦
            </FormIcon>

            <FormHeading>
              <h3>
                Edit profile
              </h3>

              <p>
                Update the name associated with your
                account.
              </p>
            </FormHeading>

          </FormHeader>

          <FormDivider />

          <form
            onSubmit={handleSubmit}
            noValidate
          >

            <Field>
              <Label htmlFor="name">
                Name
              </Label>

              <Input
                id="name"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                disabled={saving}
                autoComplete="name"
              />
            </Field>

            <Field>
              <Label htmlFor="email">
                Email
              </Label>

              <Input
                id="email"
                value={profile?.email || ''}
                disabled
                readOnly
              />

              <ReadOnlyNote>
                Your email identifies your account
                and cannot be changed here.
              </ReadOnlyNote>
            </Field>

            <SaveButton
              type="submit"
              disabled={saving || unchanged}
            >
              {saving ? (
                <>
                  <Spinner />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </SaveButton>

          </form>

        </FormCard>

      </Container>
    </Scroll>
  );
}