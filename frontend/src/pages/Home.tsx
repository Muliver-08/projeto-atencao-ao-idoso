export default function Home() {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-secondary/50 p-5">
      <h1 className="text-2xl font-semibold text-foreground">
        Bem-vindo(a)!
      </h1>
      <p className="text-lg text-muted-foreground">
        Aqui você cadastra idosos e cuidadores, vincula um ao outro e escolhe
        quem é o cuidador atual no menu no topo da tela.
      </p>
    </div>
  )
}
