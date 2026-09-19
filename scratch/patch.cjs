const fs = require('fs');
let c = fs.readFileSync('components/storefront.tsx', 'utf8');

// 1. In continueBag, remove password login and use masked fields
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
            setProfile((p) => ({ ...p, name: r.name, email: r.email, cpf: r.cpf }));
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
          setProfile((p) => ({ ...p, name: r.name, email: r.email || "", cpf: r.cpf || "" }));
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

// 2. Guest Choice: Remove password field, keep Bem-vindo
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

// 3. ContinueDelivery goes to step 2 if not signed in (even if they exist!)
const oldContinueDelivery = `  function continueDelivery() {
    if (delivery === "delivery" && (!quote || quote.expires < Date.now())) {
      toast.error("Calcule o frete para continuar.");
      return;
    }
    if (!signedIn && !customerExists) {
      setStep(2); // Go to Profile
      return;
    }
    setStep(3); // Go to Payment
  }`;

const newContinueDelivery = `  function continueDelivery() {
    if (delivery === "delivery" && (!quote || quote.expires < Date.now())) {
      toast.error("Calcule o frete para continuar.");
      return;
    }
    if (!signedIn) {
      setStep(2); // Go to Profile
      return;
    }
    setStep(3); // Go to Payment
  }`;

c = c.replace(oldContinueDelivery, newContinueDelivery);

// 4. saveProfile doesn't require password
const oldSaveProfile = `  async function saveProfile() {
    const r = profileSchema.omit({ address: true }).safeParse(profile);
    if (!r.success) {
      toast.error(r.error.issues[0].message);
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

const newSaveProfile = `  async function saveProfile() {
    const r = profileSchema.omit({ address: true }).safeParse(profile);
    if (!r.success) {
      toast.error(r.error.issues[0].message);
      return;
    }
    setProfile(r.data);
    
    if (!customerExists) {
      setBusy(true);
      try {
        if (profile.password && profile.password.length >= 6) {
          await api("customer/register", {
            method: "POST",
            body: JSON.stringify({ name: profile.name, email: profile.email || profile.phone, password: profile.password })
          });
          setSignedIn(true);
        }
      } catch (e) {
        toast.error(errorMessage(e));
        setBusy(false);
        return;
      } finally {
        setBusy(false);
      }
    }
    
    setStep(3);
  }`;

c = c.replace(oldSaveProfile, newSaveProfile);

// 5. Remove password input from Step 2 entirely (wait, if they want to create an account, maybe leave it as optional? The user said "sem senha". Let's remove it entirely for now to avoid confusion, or make it optional? If !customerExists, we can show it as optional.)
const oldPasswordField = `                    <div>
                      <Label htmlFor="customer-password">
                        Crie uma senha <span className="muted">(para acessar depois)</span>
                      </Label>
                      <Input
                        id="customer-password"
                        type="password"
                        value={profile.password || ""}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, password: e.target.value }))
                        }
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>`;

const newPasswordField = `                    {!customerExists && (
                      <div>
                        <Label htmlFor="customer-password">
                          Crie uma senha <span className="muted">(opcional)</span>
                        </Label>
                        <Input
                          id="customer-password"
                          type="password"
                          value={profile.password || ""}
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, password: e.target.value }))
                          }
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                    )}`;

c = c.replace(oldPasswordField, newPasswordField);

fs.writeFileSync('components/storefront.tsx', c);
console.log('Applied storefront fix for passwordless checkout');
