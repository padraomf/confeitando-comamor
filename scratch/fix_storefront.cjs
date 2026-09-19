const fs = require('fs');
let c = fs.readFileSync('components/storefront.tsx', 'utf8');

// 1. Remove the password check in continueBag and the login call
const oldContinueBag = `  async function continueBag() {
    if (!count || busy) return;
    if (!signedIn) {
      if (profile.phone.replace(/\\D/g, "").length < 10) {
        toast.error("Informe um telefone com DDD válido.");
        return;
      }
      setBusy(true);
      try {
        if (!customerExists) {
          const r = await api("customer/lookup-phone", {
            method: "POST",
            body: JSON.stringify({ phone: profile.phone }),
          });
          if (r.exists) {
            setCustomerExists(true);
            setProfile((p) => ({ ...p, name: r.name }));
            if (r.quote) {
              setQuote(r.quote);
              setAddress(r.quote.address);
            }
            setBusy(false);
            return;
          } else {
            setCustomerExists(false);
          }
        } else {
          if (!profile.password) {
            toast.error("Informe sua senha para entrar.");
            setBusy(false);
            return;
          }
          await api("customer/login", {
            method: "POST",
            body: JSON.stringify({ email: profile.phone.replace(/\\D/g, ""), password: profile.password })
          });
          setSignedIn(true);
        }
        setStep(1); // Go to Delivery
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    setStep(1);
  }`;

const newContinueBag = `  async function continueBag() {
    if (!count || busy) return;
    if (!signedIn) {
      if (profile.phone.replace(/\\D/g, "").length < 10) {
        toast.error("Informe um telefone com DDD válido.");
        return;
      }
      setBusy(true);
      try {
        const r = await api("customer/lookup-phone", {
          method: "POST",
          body: JSON.stringify({ phone: profile.phone }),
        });
        if (r.exists) {
          setCustomerExists(true);
          setProfile((p) => ({ ...p, name: r.name }));
          if (r.quote) {
            setQuote(r.quote);
            setAddress(r.quote.address);
          }
        } else {
          setCustomerExists(false);
        }
        setStep(1); // Go to Delivery
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    setStep(1);
  }`;

c = c.replace(oldContinueBag, newContinueBag);

// 2. Fix the guest choice form to NOT ask for password
const oldGuestChoice = `{count > 0 && !signedIn && (
                      <div className="guest-choice form-stack">
                        <p>
                          {customerExists ? \`Bem-vindo de volta, \${profile.name.split(' ')[0]}!\` : "Informe seu telefone para continuar."}
                        </p>
                        <Label htmlFor="customer-phone">Telefone com DDD</Label>
                        <Input
                          id="customer-phone"
                          autoComplete="tel-national"
                          inputMode="tel"
                          maxLength={15}
                          value={profile.phone}
                          onChange={(e) => {
                            setProfile((p) => ({ ...p, phone: formatPhone(e.target.value) }));
                            if (customerExists) setCustomerExists(false);
                          }}
                          placeholder="(00) 00000-0000"
                        />
                        {customerExists && (
                          <div style={{ marginTop: '12px' }}>
                            <Label htmlFor="customer-password">Sua senha</Label>
                            <Input
                              id="customer-password"
                              type="password"
                              value={profile.password || ""}
                              onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))}
                              placeholder="Digite sua senha para entrar"
                            />
                            <a href="/conta" target="_blank" rel="noopener noreferrer" className="small-muted" style={{ display: 'inline-block', marginTop: '8px', textDecoration: 'underline' }}>
                              Esqueci minha senha
                            </a>
                          </div>
                        )}
                      </div>
                    )}`;

const newGuestChoice = `{count > 0 && !signedIn && (
                      <div className="guest-choice form-stack">
                        <p>
                          {customerExists ? \`Bem-vindo de volta, \${profile.name.split(' ')[0]}!\` : "Informe seu telefone para continuar."}
                        </p>
                        <Label htmlFor="customer-phone">Telefone com DDD</Label>
                        <Input
                          id="customer-phone"
                          autoComplete="tel-national"
                          inputMode="tel"
                          maxLength={15}
                          value={profile.phone}
                          onChange={(e) => {
                            setProfile((p) => ({ ...p, phone: formatPhone(e.target.value) }));
                            if (customerExists) setCustomerExists(false);
                          }}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    )}`;

c = c.replace(oldGuestChoice, newGuestChoice);

// 3. Make continueDelivery ALWAYS go to step 2 if not signed in, so they see their data!
const oldContinueDelivery = `    if (!signedIn && !customerExists) {
      setStep(2); // Go to Profile
      return;
    }
    setStep(3); // Go to Payment`;

const newContinueDelivery = `    if (!signedIn) {
      setStep(2); // Go to Profile
      return;
    }
    setStep(3); // Go to Payment`;

c = c.replace(oldContinueDelivery, newContinueDelivery);

// 4. Remove the password requirement in placeOrder
const oldPlaceOrderStart = `  async function placeOrder() {
    if (busy) return;
    const valid = profileSchema.safeParse(profile);
    if (!valid.success) {
      toast.error(valid.error.issues[0].message);
      return;
    }
    if (!profile.password || profile.password.length < 6) {
      toast.error("Crie uma senha de pelo menos 6 caracteres.");
      return;
    }
    setProfile(r.data);
    setBusy(true);
    try {
      await api("customer/register", {
        method: "POST",
        body: JSON.stringify({ name: profile.name, email: profile.email || profile.phone, password: profile.password })
      });
      await api("profile", { method: "PUT", body: JSON.stringify({ ...r.data, ...(delivery === "delivery" ? { address } : { address: undefined }) }) });
      setSignedIn(true);
      setStep(3);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }`;

// Wait, I might have messed up my previous understanding. In \`storefront.tsx\`, \`placeOrder\` was calling \`api("orders")\`.
// Wait! Let's check what \`storefront.tsx\` actually looks like right now because I might be confusing \`continueProfile\` with \`placeOrder\`.
fs.writeFileSync('scratch/fix_storefront.cjs', c); // temporary save just in case
