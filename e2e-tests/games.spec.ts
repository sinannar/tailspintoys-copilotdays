// End-to-end coverage for game catalog listing, filtering, and detail navigation.

import { test, expect, type Response } from '@playwright/test';

test.describe('Game Listing and Navigation', () => {
  test('should display games with titles on index page', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
    });

    await test.step('Verify games grid is visible', async () => {
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Verify game cards are displayed', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first()).toBeVisible();
      expect(await gameCards.count()).toBeGreaterThan(0);
    });

    await test.step('Verify game cards have titles with content', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first().getByTestId('game-title')).toBeVisible();
      await expect(gameCards.first().getByTestId('game-title')).not.toBeEmpty();
    });
  });

  test.describe('Game Catalog Filters', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });

    test('filters by one or more categories and stores selections in the URL', async ({ page }) => {
      const strategyFilter = page.getByRole('checkbox', { name: 'Strategy' });
      const puzzleFilter = page.getByRole('checkbox', { name: 'Puzzle' });
      const visibleCards = page.locator('[data-testid="game-card"]:visible');

      await test.step('Select one category', async () => {
        await strategyFilter.check();

        await expect(visibleCards).toHaveCount(4);
        await expect(page.getByTestId('filter-status')).toHaveText('Showing 4 of 21 games.');
        const categoryNames = await visibleCards.getByTestId('game-category').allTextContents();
        expect(new Set(categoryNames)).toEqual(new Set(['Strategy']));
        expect(new URL(page.url()).searchParams.getAll('category')).toEqual([
          await strategyFilter.getAttribute('value'),
        ]);
      });

      await test.step('Add a second category', async () => {
        await puzzleFilter.check();

        await expect(visibleCards).toHaveCount(8);
        await expect(page.getByTestId('filter-status')).toHaveText('Showing 8 of 21 games.');
        const categoryNames = await visibleCards.getByTestId('game-category').allTextContents();
        expect(new Set(categoryNames)).toEqual(new Set(['Puzzle', 'Strategy']));
        expect(new URL(page.url()).searchParams.getAll('category')).toEqual([
          await puzzleFilter.getAttribute('value'),
          await strategyFilter.getAttribute('value'),
        ]);
      });
    });

    test('filters by publisher and combines it with a category', async ({ page }) => {
      const publisherFilter = page.getByRole('combobox', { name: 'Publisher' });
      const strategyFilter = page.getByRole('checkbox', { name: 'Strategy' });
      const visibleCards = page.locator('[data-testid="game-card"]:visible');

      await test.step('Select a publisher', async () => {
        await publisherFilter.selectOption({ label: 'GitHub Games' });

        await expect(visibleCards).toHaveCount(5);
        const publisherNames = await visibleCards.getByTestId('game-publisher').allTextContents();
        expect(new Set(publisherNames)).toEqual(new Set(['GitHub Games']));
      });

      await test.step('Combine publisher and category filters', async () => {
        await strategyFilter.check();

        await expect(visibleCards).toHaveCount(1);
        await expect(visibleCards.getByTestId('game-title')).toHaveText('Server Siege');
        await expect(page.getByTestId('filter-status')).toHaveText('Showing 1 of 21 games.');

        const url = new URL(page.url());
        expect(url.searchParams.get('publisher')).toBe(await publisherFilter.inputValue());
        expect(url.searchParams.getAll('category')).toEqual([
          await strategyFilter.getAttribute('value'),
        ]);
      });
    });

    test('clears active filters and restores the full catalog', async ({ page }) => {
      const publisherFilter = page.getByRole('combobox', { name: 'Publisher' });
      const strategyFilter = page.getByRole('checkbox', { name: 'Strategy' });
      const clearButton = page.getByRole('button', { name: 'Clear filters' });

      await strategyFilter.check();
      await publisherFilter.selectOption({ label: 'GitHub Games' });
      await expect(clearButton).toBeEnabled();

      await clearButton.click();

      await expect(strategyFilter).not.toBeChecked();
      await expect(publisherFilter).toHaveValue('');
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(21);
      await expect(page.getByTestId('filter-status')).toHaveText('Showing all 21 games.');
      await expect(clearButton).toBeDisabled();
      await expect(page).toHaveURL('/');
    });

    test('restores valid filters from URL query parameters', async ({ page }) => {
      const strategyFilter = page.getByRole('checkbox', { name: 'Strategy' });
      const publisherFilter = page.getByRole('combobox', { name: 'Publisher' });
      const strategyId = await strategyFilter.getAttribute('value');
      const githubGamesId = await publisherFilter
        .getByRole('option', { name: 'GitHub Games' })
        .getAttribute('value');

      await page.goto(`/?category=${strategyId}&publisher=${githubGamesId}`);

      await expect(page.getByRole('checkbox', { name: 'Strategy' })).toBeChecked();
      await expect(page.getByRole('combobox', { name: 'Publisher' })).toHaveValue(
        githubGamesId ?? '',
      );
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(1);
      await expect(
        page.locator('[data-testid="game-card"]:visible').getByTestId('game-title'),
      ).toHaveText('Server Siege');
    });

    test('removes unknown filter values from the URL', async ({ page }) => {
      await page.goto('/?category=99999&publisher=99999');

      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(21);
      await expect(page.getByTestId('filter-status')).toHaveText('Showing all 21 games.');
      await expect(page).toHaveURL('/');
    });
  });

  test('should navigate to correct game details page when clicking on a game', async ({ page }) => {
    let gameId: string | null;
    let gameTitle: string | null;

    await test.step('Navigate to homepage and wait for games to load', async () => {
      await page.goto('/');
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Get first game information and click it', async () => {
      const firstGameCard = page.getByTestId('game-card').first();
      gameId = await firstGameCard.getAttribute('data-game-id');
      gameTitle = await firstGameCard.getAttribute('data-game-title');
      await firstGameCard.click();
    });

    await test.step('Verify navigation to game details page', async () => {
      await expect(page).toHaveURL(`/game/${gameId}`);
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title matches clicked game', async () => {
      if (gameTitle) {
        await expect(page.getByTestId('game-details-title')).toHaveText(gameTitle);
      }
    });
  });

  test('should display game details with all required information', async ({ page }) => {
    await test.step('Navigate to specific game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title is displayed', async () => {
      const gameTitle = page.getByTestId('game-details-title');
      await expect(gameTitle).toBeVisible();
      await expect(gameTitle).not.toBeEmpty();
    });

    await test.step('Verify game description is displayed', async () => {
      const gameDescription = page.getByTestId('game-details-description');
      await expect(gameDescription).toBeVisible();
      await expect(gameDescription).not.toBeEmpty();
    });

    await test.step('Verify publisher or category information is present', async () => {
      const publisherExists = await page.getByTestId('game-details-publisher').isVisible();
      const categoryExists = await page.getByTestId('game-details-category').isVisible();
      expect(publisherExists || categoryExists).toBeTruthy();

      if (publisherExists) {
        await expect(page.getByTestId('game-details-publisher')).not.toBeEmpty();
      }

      if (categoryExists) {
        await expect(page.getByTestId('game-details-category')).not.toBeEmpty();
      }
    });
  });

  test('should display a button to back the game', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify back game button is visible and enabled', async () => {
      const backButton = page.getByTestId('back-game-button');
      await expect(backButton).toBeVisible();
      await expect(backButton).toContainText('Support This Game');
      await expect(backButton).toBeEnabled();
    });
  });

  test('should be able to navigate back to home from game details', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Click back to all games link', async () => {
      const backLink = page.getByRole('link', { name: /back to all games/i });
      await expect(backLink).toBeVisible();
      await backLink.click();
    });

    await test.step('Verify navigation back to homepage', async () => {
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });
  });

  test('should return a 404 page for a non-existent game', async ({ page }) => {
    let response: Response | null;

    await test.step('Navigate to non-existent game', async () => {
      response = await page.goto('/game/99999');
    });

    await test.step('Verify a branded 404 page is served', async () => {
      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(/Page Not Found - Tailspin Toys/);
      await expect(page.getByTestId('not-found')).toBeVisible();
      await expect(page.getByTestId('not-found-heading')).not.toBeEmpty();
      await expect(page.getByTestId('not-found-home-link')).toBeVisible();
    });
  });
});
