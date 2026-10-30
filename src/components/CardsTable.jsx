import { Link } from "@tanstack/react-router";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useState } from "react";
import { formatPrice } from "../domain/card";
import { RarityBadge } from "./RarityBadge";
import { RemoveCardButton } from "./RemoveCardButton";

const PAGE_SIZES = [5, 10, 20];
const SORT_ARROWS = { asc: " ▲", desc: " ▼" };
const ARIA_SORT = { asc: "ascending", desc: "descending" };

const columnHelper = createColumnHelper();

// Hors du composant : référence stable, la table ne recalcule pas ses colonnes à chaque rendu.
const columns = [
  columnHelper.accessor("name", { header: "Nom" }),
  columnHelper.accessor("set", { header: "Extension" }),
  columnHelper.accessor("rarity", {
    header: "Rareté",
    cell: (info) => <RarityBadge rarity={info.getValue()} />,
  }),
  columnHelper.accessor("price", {
    header: "Prix",
    cell: (info) => formatPrice(info.getValue()),
  }),
  columnHelper.accessor("quantity", { header: "Quantité" }),
  columnHelper.accessor((card) => card.price * card.quantity, {
    id: "value",
    header: "Valeur",
    cell: (info) => formatPrice(info.getValue()),
    // Colonne calculée : json-server ne peut pas trier dessus (_sort porte sur un champ stocké).
    enableSorting: false,
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="actions">
        <Link to="/cards/$cardId" params={{ cardId: row.original.id }}>Détail</Link>
        <RemoveCardButton cardId={row.original.id} />
      </div>
    ),
  }),
];

// Table « contrôlée » : tri et pagination viennent du parent (l'URL) et sont
// appliqués par le serveur. La table ne fait que les afficher et émettre les changements.
export function CardsTable({ cards, rowCount, sorting, onSortingChange, pagination, onPaginationChange }) {
  // Préférence d'affichage purement locale : état local.
  const [columnVisibility, setColumnVisibility] = useState({});

  // Avertissement « React Compiler » sans objet ici : le projet n'utilise pas le compilateur.
  // eslint-disable-next-line react/incompatible-library
  const table = useReactTable({
    data: cards,
    columns,
    getRowId: (card) => card.id,
    getCoreRowModel: getCoreRowModel(),
    state: { sorting, pagination, columnVisibility },
    onSortingChange,
    onPaginationChange,
    onColumnVisibilityChange: setColumnVisibility,
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    rowCount,
    enableMultiSort: false,
    sortDescFirst: false,
  });

  return (
    <div className="table-view">
      <fieldset className="column-toggles">
        <legend>Colonnes affichées</legend>
        {table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => (
          <label key={column.id}>
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
            />
            {column.columnDef.header}
          </label>
        ))}
      </fieldset>

      <div className="table-scroll">
        <table className="cards-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={canSort ? (ARIA_SORT[sorted] ?? "none") : undefined}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          className="sort-button"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span aria-hidden="true">{SORT_ARROWS[sorted] ?? ""}</span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
            {rowCount === 0 && (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className="hint">
                  Aucune carte à afficher.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          ← Précédent
        </button>
        <span>
          Page {pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
        </span>
        <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Suivant →
        </button>
        <label>
          Par page{" "}
          <select value={pagination.pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))}>
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
