import { createFileRoute } from "@tanstack/react-router";
import { AddCardForm } from "../components/AddCardForm";
import { Panel } from "../components/Panel";
import { RouteError } from "../components/RouteError";

export const Route = createFileRoute("/add")({
  errorComponent: RouteError,
  component: AddPage,
});

function AddPage() {
  return (
    <Panel title="Ajouter une carte">
      <AddCardForm />
    </Panel>
  );
}
